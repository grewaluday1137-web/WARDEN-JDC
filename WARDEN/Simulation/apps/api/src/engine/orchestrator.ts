import { Zone, SimulationMode, TickPayload, TickPayloadDelta } from '../types';
import { EnvironmentEngine } from './environment';
import { SensorGrid } from './sensors';
import { BLEEngine } from './ble';
import { StateMachine } from './state-machine';
import { CVBridge } from './cv-bridge';
import { PredictionEngine } from './prediction-engine';
import { EvacuationEngine } from './evacuation-engine';
import { FaultManager } from '../services/fault-manager';
import { SessionService } from '../services/session-service';
import { TelemetryLogger } from '../services/telemetry-logger';
import { GraphTickProcessor } from '../simulation/tick';
import { CrisisEventBus } from '../simulation/eventBus';

export interface OrchestratorOptions {
  env: EnvironmentEngine;
  sensorGrid: SensorGrid;
  ble: BLEEngine;
  stateMachine: StateMachine;
  cvBridge: CVBridge;
  predictionEngine: PredictionEngine;
  evacuationEngine: EvacuationEngine;
  faultManager: FaultManager;
  sessionService: SessionService;
  telemetryLogger: TelemetryLogger;
  graphTickProcessor: GraphTickProcessor;
  eventBus: CrisisEventBus;
  onTick: (payload: TickPayload, delta: TickPayloadDelta) => void;
}

export class SimulationOrchestrator {
  private tickInterval: NodeJS.Timeout | null = null;
  private tickCount = 0;
  private simulationMode: SimulationMode = 'stopped';
  private lastPayload: TickPayload | null = null;
  private opts: OrchestratorOptions;

  constructor(opts: OrchestratorOptions) {
    this.opts = opts;
  }

  public getTickCount() { return this.tickCount; }
  public getSimulationMode() { return this.simulationMode; }

  public start(mode: SimulationMode = 'auto') {
    this.simulationMode = mode;
    console.log(`[SIM] Floor orchestrator set to ${mode} mode`);
  }

  public tick() {
    return this.simulationTick();
  }

  public stop() {
    this.simulationMode = 'stopped';
    console.log('[SIM] Floor orchestrator stopped');
  }

  public reset() {
    this.stop();
    this.tickCount = 0;
    this.lastPayload = null;

    // Deep reset all sub-engines
    this.opts.env.reset();
    const activeZones = this.opts.env.getZones();
    this.opts.stateMachine.reset(activeZones);
    this.opts.ble.reset();
    this.opts.predictionEngine.reset();
    this.opts.evacuationEngine.reset();
    this.opts.faultManager.reset();
    this.opts.graphTickProcessor.reset();
    this.opts.eventBus.clear();

    console.log(`[SIM] Floor ${this.opts.env.getFloorId()} full orchestrator reset complete`);
  }

  private async simulationTick() {
    this.tickCount++;
    const { env, sensorGrid, ble, stateMachine, cvBridge, predictionEngine, evacuationEngine, faultManager, sessionService, telemetryLogger, graphTickProcessor, eventBus, onTick } = this.opts;

    // 0. Expire timed faults
    faultManager.tick(this.tickCount);

    // Dynamic zone list — sourced from EnvironmentEngine (the truth)
    const activeZones = env.getZones();

    // 1. Physics tick
    const verticalLeakage = env.tick();

    // 3. Generate sensor readings
    const allPhysics = env.getAllPhysics();
    const sensorReadings = sensorGrid.generateReadings(allPhysics);

    // 4. Send TRIGGERED zones to CV for confirmation
    const triggeredZones = stateMachine.getTriggeredZones();
    for (const zone of triggeredZones) {
      const sent = stateMachine.requestCVConfirmation(zone);
      if (sent) {
        console.log(`[CV] 📷 Requesting camera verification for Zone ${zone}`);
        const zoneState = stateMachine.getZoneState(zone);
        const cycleId = stateMachine.getZoneCycleId(zone);
        cvBridge.analyzeZone(zone, zoneState.incidentType!).then(result => {
          if (result.confirmed) {
            console.log(`[CV] ✅ CONFIRMED ${result.detectionType} in Zone ${result.zoneId} (${(result.confidence * 100).toFixed(0)}%)`);
          } else {
            console.log(`[CV] ❌ Not confirmed in Zone ${result.zoneId} — returning to standby`);
          }
          stateMachine.receiveCVResult(result, cycleId);

          const updatedState = stateMachine.getZoneState(zone);
          if (updatedState.phase === 'PINPOINT') {
            console.log(`[BLE] 📡 Sweep ACTIVATED for Zone ${zone}`);
            ble.activateZone(zone);
          }
        }).catch(err => {
          console.log(`[CV] 🚨 Error -> [ERROR_FALLBACK] Transitioning Zone ${zone} to MANUAL REVIEW REQUIRED`);
          stateMachine.receiveCVResult({
            zoneId: zone,
            confirmed: false,
            confidence: 0,
            detectionType: zoneState.incidentType!,
            signals: ['fallback_manual_review'],
            timestamp: Date.now()
          }, cycleId);
        });
      }
    }

    // 6. Check for CV timeouts
    const timedOut = stateMachine.checkCVTimeouts();
    for (const z of timedOut) {
      console.log(`[CV] ⏱️  Timeout in Zone ${z} → MANUAL REVIEW`);
    }

    // 7. BLE positioning tick
    const pinpointZones = stateMachine.getPinpointZones();
    for (const z of ble.getActiveZones()) {
      if (!pinpointZones.includes(z)) ble.deactivateZone(z);
    }
    const blePositions = ble.tick();

    // 7.4. Graph tick (before evacuation to ensure paths reflect actual crisis)
    const graphState = graphTickProcessor.tick(allPhysics, this.tickCount);
    const crisisEvents = eventBus.flushTick();

    // 7.5. Evacuation tick
    if (evacuationEngine.isRunning()) {
      evacuationEngine.tick(allPhysics, this.tickCount);
    }

    // 8. Build full payload
    const activeEvents = stateMachine.getRecentEvents(200);
    const activePlaybook = stateMachine.getPlaybook();
    const activeZonesList = ble.getActiveZones();

    const hasActiveIncident = activeZones.some(
      z => stateMachine.getZoneState(z).phase !== 'STANDBY'
    );
    const filteredReadings = hasActiveIncident ? sensorReadings : sensorReadings.filter(r => r.isAnomalous);

    const truncatedBle = blePositions.map(p => ({
      ...p,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
    }));

    const zoneStates = stateMachine.getAllStates();
    const predictions = predictionEngine.getPredictions();
    const activeFailures = faultManager.getActiveFaults();
    const evacuationAgents = evacuationEngine.isRunning() ? evacuationEngine.getAgents() : undefined;
    const evacuationMetrics = evacuationEngine.getMetrics(this.tickCount);
    const evacuationActive = evacuationEngine.isRunning();

    const currentPayload: TickPayload = {
      timestamp: Date.now(),
      tick: this.tickCount,
      simulationMode: this.simulationMode,
      zonePhysics: allPhysics,
      zoneStates,
      sensorReadings: filteredReadings,
      blePositions: truncatedBle,
      bleActive: activeZonesList,
      events: activeEvents,
      playbook: activePlaybook,
      predictions,
      activeFailures,
      evacuationAgents,
      evacuationMetrics,
      evacuationActive,
      graphState,
      crisisEvents,
      restrictedZone: this.opts.env.getRestrictedZone() || undefined,
    };

    // 9. Compute Delta Sync — uses dynamic zone list
    const delta: TickPayloadDelta = {
      timestamp: currentPayload.timestamp,
      tick: currentPayload.tick,
    };

    if (!this.lastPayload) {
      Object.assign(delta, currentPayload);
    } else {
      if (this.lastPayload.simulationMode !== currentPayload.simulationMode) delta.simulationMode = currentPayload.simulationMode;
      if (this.lastPayload.restrictedZone !== currentPayload.restrictedZone) delta.restrictedZone = currentPayload.restrictedZone;
      
      const pDiff: any = {};
      const sDiff: any = {};
      let pChanged = false;
      let sChanged = false;

      // Dynamic zone diff — iterate over all zones in the current physics
      for (const z of activeZones) {
        if (JSON.stringify(this.lastPayload.zonePhysics[z]) !== JSON.stringify(currentPayload.zonePhysics[z])) {
          pDiff[z] = currentPayload.zonePhysics[z];
          pChanged = true;
        }
        if (JSON.stringify(this.lastPayload.zoneStates[z]) !== JSON.stringify(currentPayload.zoneStates[z])) {
          sDiff[z] = currentPayload.zoneStates[z];
          sChanged = true;
        }
      }

      if (pChanged) delta.zonePhysics = pDiff;
      if (sChanged) delta.zoneStates = sDiff;

      // For arrays/objects that are small or need whole replacement:
      delta.sensorReadings = currentPayload.sensorReadings;
      delta.blePositions = currentPayload.blePositions;
      if (JSON.stringify(this.lastPayload.bleActive) !== JSON.stringify(currentPayload.bleActive)) delta.bleActive = currentPayload.bleActive;
      delta.events = currentPayload.events;
      if (JSON.stringify(this.lastPayload.playbook) !== JSON.stringify(currentPayload.playbook)) delta.playbook = currentPayload.playbook;
      if (JSON.stringify(this.lastPayload.predictions) !== JSON.stringify(currentPayload.predictions)) delta.predictions = currentPayload.predictions;
      if (JSON.stringify(this.lastPayload.activeFailures) !== JSON.stringify(currentPayload.activeFailures)) delta.activeFailures = currentPayload.activeFailures;
      
      if (evacuationActive) {
        delta.evacuationAgents = currentPayload.evacuationAgents;
        delta.evacuationMetrics = currentPayload.evacuationMetrics;
      }
      if (this.lastPayload.evacuationActive !== currentPayload.evacuationActive) {
        delta.evacuationActive = currentPayload.evacuationActive;
      }
      // Graph state changes every tick during an incident
      delta.graphState = currentPayload.graphState;
      if (currentPayload.crisisEvents && currentPayload.crisisEvents.length > 0) {
        delta.crisisEvents = currentPayload.crisisEvents;
      }
    }

    this.lastPayload = currentPayload;

    // 10. Server-side Status Log
    if (this.tickCount % 60 === 0) {
      const zoneInfo = activeZones.map(z => {
        const s = zoneStates[z];
        const p = allPhysics[z];
        if (!s || !p) return `${z}: ---`;
        const phase = s.phase.padEnd(10);
        const temp = p.temperature.toFixed(0).padStart(4) + '°C';
        const smoke = p.smokeDensity.toFixed(0).padStart(3) + '%';
        const incident = s.incidentType ? ` [${s.incidentType}]` : '';
        return `${z}:${phase} ${temp} ${smoke}${incident}`;
      }).join('  │  ');
      console.log(`[F${env.getFloorId()}][T:${String(this.tickCount).padStart(4)}] ${zoneInfo}  │  BLE: ${truncatedBle.length} tracked`);
    }

    // 11. Dispatch
    telemetryLogger.logTick(delta);
    onTick(currentPayload, delta);

    return verticalLeakage;
  }

  public getSnapshot(): TickPayload {
    if (this.lastPayload) return this.lastPayload;
    return {
      timestamp: Date.now(),
      tick: this.tickCount,
      simulationMode: this.simulationMode,
      zonePhysics: this.opts.env.getAllPhysics(),
      zoneStates: this.opts.stateMachine.getAllStates(),
      sensorReadings: [],
      blePositions: [],
      bleActive: [],
      events: [],
      playbook: [],
      predictions: [],
      activeFailures: [],
      evacuationAgents: [],
      evacuationMetrics: null,
      evacuationActive: false,
      graphState: this.opts.graphTickProcessor.tick(this.opts.env.getAllPhysics(), this.tickCount),
      crisisEvents: [],
      restrictedZone: this.opts.env.getRestrictedZone() || undefined,
    };
  }
}
