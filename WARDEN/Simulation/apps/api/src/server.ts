// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Unified API Server (Multi-Floor)
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';


import type { Zone, IncidentType, SimulationMode, TickPayload, FloorId } from './types';
import {
  InjectSchema,
  ResolveSchema,
  PlaybookCompleteSchema,
  StartSimSchema,
  DependencyArraySchema,
  FailureInjectionSchema,
  ALL_FLOORS,
  FLOOR_COUNT,
} from './types';

import { EnvironmentEngine } from './engine/environment';
import { SensorGrid } from './engine/sensors';
import { BLEEngine } from './engine/ble';
import { StateMachine } from './engine/state-machine';
import { CVBridge } from './engine/cv-bridge';
import { AutoSimulator } from './engine/auto-simulator';
import { PredictionEngine } from './engine/prediction-engine';
import { EvacuationEngine } from './engine/evacuation-engine';
import { SimulationOrchestrator } from './engine/orchestrator';
import { CellularAutomataEngine } from './engine/cellular-automata';
import { CrisisEventBus } from './simulation/eventBus';
import { GraphTickProcessor } from './simulation/tick';
import { TelemetryLogger } from './services/telemetry-logger';
import { ConfigService } from './services/config-service';
import { SessionService } from './services/session-service';
import { FaultManager } from './services/fault-manager';
import { ReportService } from './services/report-service';
import { ExternalAlertService } from './services/external-alert-service';
import { TaskBoardService } from './services/task-board-service';

// ─── Server Setup ─────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory (Dashboard)
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  // If the dashboard is built, serve it. Otherwise show the API status.
  res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
    if (err) {
      res.json({ status: 'Simulation Engine Running', time: new Date(), message: 'Dashboard not found' });
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Shared Services ──────────────────────────────────────────────────────────
const configService = new ConfigService();
const sessionService = new SessionService();
const reportService = new ReportService();
const externalAlertService = new ExternalAlertService();
const taskBoardService = new TaskBoardService();

// ─── Per-Floor Engine Set ─────────────────────────────────────────────────────
interface FloorEngineSet {
  floor: FloorId;
  faultManager: FaultManager;
  eventBus: CrisisEventBus;
  graphTickProcessor: GraphTickProcessor;
  env: EnvironmentEngine;
  sensorGrid: SensorGrid;
  ble: BLEEngine;
  stateMachine: StateMachine;
  cvBridge: CVBridge;
  predictionEngine: PredictionEngine;
  evacuationEngine: EvacuationEngine;
  telemetryLogger: TelemetryLogger;
  orchestrator: SimulationOrchestrator;
  cellularAutomata: CellularAutomataEngine;
}

const floorEngines = new Map<FloorId, FloorEngineSet>();

function buildFloorSnapshot(): { floorPhysics: Record<number, any>; floorStates: Record<number, any>; floorGraphs: Record<number, any>; floorEpicenters: Record<number, any> } {
  const floorPhysics: Record<number, Record<Zone, any>> = {};
  const floorStates: Record<number, Record<Zone, any>> = {};
  const floorGraphs: Record<number, any> = {};
  const floorEpicenters: Record<number, any> = {};
  for (const [fid, fset] of floorEngines) {
    floorPhysics[fid] = fset.env.getAllPhysics();
    floorStates[fid] = fset.stateMachine.getAllStates();
    floorGraphs[fid] = fset.orchestrator.getSnapshot().graphState;
    floorEpicenters[fid] = fset.graphTickProcessor.getEpicenters();
  }
  return { floorPhysics, floorStates, floorGraphs, floorEpicenters };
}

function createFloorEngines(floor: FloorId): FloorEngineSet {
  const faultManager = new FaultManager();
  const eventBus = new CrisisEventBus();
  const graphTickProcessor = new GraphTickProcessor(eventBus, floor);
  const graphData = graphTickProcessor.getGraphData();
  const env = new EnvironmentEngine(floor, graphData);

  // Discover actual zones from graph data for this floor
  const activeZones = env.getZones();
  console.log(`[FLOOR ${floor}] Active zones: ${activeZones.join(', ')}`);

  const sensorGrid = new SensorGrid(faultManager, graphData, activeZones);
  const ble = new BLEEngine(floor, faultManager, graphData);
  const stateMachine = new StateMachine(floor, activeZones);
  stateMachine.setExternalAlertService(externalAlertService);
  const cvBridge = new CVBridge(faultManager);
  const autoSim = new AutoSimulator();
  const predictionEngine = new PredictionEngine(env, configService);
  const evacuationEngine = new EvacuationEngine(configService, graphData, eventBus);
  const telemetryLogger = new TelemetryLogger();
  ble.initialize(25);

  const orchestrator = new SimulationOrchestrator({
    env, sensorGrid, ble, stateMachine, cvBridge, predictionEngine,
    evacuationEngine, faultManager, sessionService, telemetryLogger,
    graphTickProcessor, eventBus,
    onTick: (_payload, _delta) => {
      // Broadcast moved to master loop to ensure unified multi-floor sync
    }
  });

  const cellularAutomata = new CellularAutomataEngine(floor);

  return {
    floor, faultManager, eventBus, graphTickProcessor, env, sensorGrid, ble,
    stateMachine, cvBridge, predictionEngine, evacuationEngine,
    telemetryLogger, orchestrator, cellularAutomata,
  };
}

// Instantiate one engine set per floor
for (const f of ALL_FLOORS) {
  floorEngines.set(f, createFloorEngines(f));
  console.log(`[FLOOR ${f}] Engine set initialized`);
}

// Convenience: floor 1 aliases for shared/legacy routes
const f1 = floorEngines.get(1)!;
const { faultManager, env, ble, stateMachine, predictionEngine, evacuationEngine, orchestrator } = f1;

// ─── Global Scenario Director ────────────────────────────────────────────────
const globalAutoSimulator = new AutoSimulator();

// Helper: resolve floor from request body (defaults to 1)
function getFloor(body: any): FloorId {
  const f = Number(body?.floor);
  if (f === 2 || f === 3) return f as FloorId;
  return 1;
}

// ─── REST API Routes ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; line-height: 1.6;">
      <h1 style="color: #2563eb;">WARDEN Simulation API</h1>
      <p>The multi-floor simulation engine is <strong>LIVE</strong> and running.</p>
      <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px;">
        <h3 style="margin-top: 0;">Available Endpoints:</h3>
        <ul style="list-style: none; padding: 0;">
          <li>✅ <a href="/api/health">/api/health</a> - Check status and ticks</li>
          <li>✅ <a href="/api/snapshot">/api/snapshot</a> - Get full simulation state</li>
          <li>✅ <a href="/api/facility/config">/api/facility/config</a> - View facility layout</li>
        </ul>
      </div>
      <p style="color: #6b7280; font-size: 0.875rem; margin-top: 2rem;">
        Status: <strong>Running on Port 3001</strong>
      </p>
    </div>
  `);
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    tick: orchestrator.getTickCount(),
    mode: orchestrator.getSimulationMode(),
    cvAvailable: f1.cvBridge.getAvailability(),
    floorCount: FLOOR_COUNT,
  });
});

// ─── Prediction Explainability ────────────────────────────────────────────────

app.get('/api/predictions', (_req, res) => {
  res.json(predictionEngine.getPredictions());
});

app.get('/api/predictions/explanations', (_req, res) => {
  res.json(predictionEngine.getExplanations());
});

app.get('/api/predictions/:id/explanation', (req, res) => {
  const explanation = predictionEngine.getExplanation(req.params.id);
  if (!explanation) return res.status(404).json({ error: 'Prediction not found or expired' });
  res.json(explanation);
});

// ─── Master Simulation Loop ──────────────────────────────────────────────────
let masterTickInterval: NodeJS.Timeout | null = null;
let masterTickCount = 0;
let simulationMode: SimulationMode = 'stopped';

  if (simulationMode === 'stopped') return;
  masterTickCount++;
  if (masterTickCount % 20 === 0) console.log(`[SIM] Master tick ${masterTickCount} running in mode: ${simulationMode}`);

  // Vertical Physics Bus: Data flowing from Floor N to Floor N+1
  let carryOverLeakage: Record<string, any> = {};

  for (const floor of ALL_FLOORS) {
    const fset = floorEngines.get(floor)!;

    // 1. Pull leakage from floor below
    for (const [zone, energy] of Object.entries(carryOverLeakage)) {
      fset.env.injectVerticalEnergy(zone, energy);
    }

    // 2. Execute tick for this floor
    // Note: orchestrator.tick() now returns verticalLeakage for the next floor
    carryOverLeakage = await fset.orchestrator.tick();

    // 2.1 Tick Cellular Automata for this floor
    fset.cellularAutomata.tick();
  }

  // 2.5 Global Auto Simulator Tick
  if (simulationMode === 'auto') {
    const autoEvent = globalAutoSimulator.tick();
    if (autoEvent) {
      const fset = floorEngines.get(autoEvent.floor);
      if (fset) {
        // Pick a random node for this zone from the graph
        const nodes = Array.from(fset.graphTickProcessor.getGraphData().nodes.values())
          .filter(n => n.parentZone === autoEvent.zone);
        
        if (nodes.length > 0) {
          const targetNode = nodes[Math.floor(Math.random() * nodes.length)];
          console.log(`[GLOBAL AUTO] 🎲 Triggering auto-event: ${autoEvent.type} on Floor ${autoEvent.floor}, Zone ${autoEvent.zone} (Node ${targetNode.id})`);
          
          fset.graphTickProcessor.addEpicenter(autoEvent.zone as Zone, targetNode.id);
          fset.env.injectIncident(autoEvent.zone, autoEvent.type);
          fset.stateMachine.trigger(targetNode.id as any, autoEvent.type);

          // Also inject into CA grid
          fset.cellularAutomata.injectIncident(targetNode.x, targetNode.y, autoEvent.type);
        }
      }
    }
  }

  // 3. Unified Broadcast: One event containing ALL floor data
  const { floorPhysics, floorStates, floorGraphs, floorEpicenters } = buildFloorSnapshot();
  const f1Snap = f1.orchestrator.getSnapshot();

  // Aggregate events from ALL floors
  let allEvents: any[] = [];
  for (const [, fset] of floorEngines) {
    allEvents = [...allEvents, ...fset.stateMachine.getRecentEvents(100)];
  }
  // Sort by timestamp
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  // Build CA grid states for all floors
  const floorCAGrids: Record<number, any> = {};
  for (const [fid, fset] of floorEngines) {
    floorCAGrids[fid] = fset.cellularAutomata.getState();
  }
  
  const tickPayload = { 
    ...f1Snap, 
    events: allEvents,
    floorCount: FLOOR_COUNT, 
    floorPhysics, 
    floorStates,
    floorGraphs,
    floorEpicenters,
    floorCAGrids,
  };

  io.emit('tick', tickPayload);

  // Forward to Backend (Decoupling)
  const backendUrl = process.env.BACKEND_URL || 'https://warden-backend-774533752332.us-central1.run.app';
  fetch(`${backendUrl}/api/simulation/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tickPayload),
    signal: AbortSignal.timeout(1000)
  }).catch(err => {
    // Silent fail if backend is down to avoid crashing sim
  });
}

// ─── Simulation Control ───────────────────────────────────────────────────────

app.post('/api/simulation/start', (req, res) => {
  const parsed = StartSimSchema.safeParse(req.body);
  const mode: SimulationMode = parsed.success && parsed.data ? parsed.data.mode : 'manual';
  simulationMode = mode;

  // Initialize all floor engines
  const floorZones = new Map<FloorId, Zone[]>();
  for (const [floorId, fset] of floorEngines) {
    fset.orchestrator.reset(); // Full reset before starting
    fset.orchestrator.start(mode);
    fset.env.setRestrictedZone(null);
    fset.predictionEngine.start();
    floorZones.set(floorId, fset.env.getZones());
  }

  if (mode === 'auto') {
    globalAutoSimulator.start(floorZones);
  }

  // Start the single master tick loop if not already running
  // Start the single master tick loop at 250ms for higher fidelity/responsiveness
  if (!masterTickInterval) {
    masterTickInterval = setInterval(() => runMasterTick(), 250);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  🚀 MASTER SIMULATION STARTED [Mode: ${mode.toUpperCase()}]`);
    console.log('═══════════════════════════════════════════════════════════════');
  }

  sessionService.startSession(mode);
  res.json({ success: true, mode, floorCount: FLOOR_COUNT });
});

app.post('/api/simulation/stop', (_req, res) => {
  simulationMode = 'stopped';
  globalAutoSimulator.stop();
  if (masterTickInterval) {
    clearInterval(masterTickInterval);
    masterTickInterval = null;
    console.log('[SIM] Master tick loop stopped');
  }

  const endedSession = sessionService.endSession(masterTickCount);

  for (const [, fset] of floorEngines) {
    fset.orchestrator.stop();
    fset.evacuationEngine.stop();
    fset.evacuationEngine.reset();
    fset.faultManager.clearAll();
    fset.predictionEngine.reset();
    fset.env.reset();
    fset.env.setRestrictedZone(null);
    fset.stateMachine.reset();
    fset.ble.reset(25);
    fset.graphTickProcessor.reset();
    fset.orchestrator.reset();
    fset.cellularAutomata.reset();
  }
  taskBoardService.reset();

  const { floorPhysics, floorStates, floorGraphs, floorEpicenters } = buildFloorSnapshot();
  io.emit('snapshot', { 
    ...f1.orchestrator.getSnapshot(), 
    floorCount: FLOOR_COUNT, 
    floorPhysics, 
    floorStates,
    floorGraphs,
    floorEpicenters
  });

  res.json({ success: true, sessionId: endedSession?.id });
});

// ─── Manual Injection (floor-aware) ──────────────────────────────────────────

app.post('/api/inject', (req, res) => {
  const parsed = InjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

  const { zone, incidentType, floor, nodeId } = parsed.data;
  
  // Audit logging to trace spontaneous events
  console.log(`[AUDIT] Injection Request: ${JSON.stringify(req.body)} from ${req.ip} (${req.headers['user-agent']})`);

  // Normalize floors to array
  const floorsToInject: FloorId[] = [];
  if (Array.isArray(floor)) {
    floorsToInject.push(...(floor as FloorId[]));
  } else if (floor) {
    floorsToInject.push(floor as FloorId);
  } else {
    floorsToInject.push(...ALL_FLOORS);
  }

  // Normalize incidentTypes to array
  const typesToInject: IncidentType[] = Array.isArray(incidentType) ? incidentType : [incidentType];

  // ─── SINGLE NODE CONSTRAINT ────────────────────────────────────────────────
  // The user requested that only ONE node building-wide gets activated per injection.
  // We pick exactly one floor from the selection.
  let fId = floorsToInject[Math.floor(Math.random() * floorsToInject.length)];
  
  if (typesToInject.includes('active_shooter')) {
    fId = 1; // Force Floor 1 for Hostile Behaviour
  }
  
  const fset = floorEngines.get(fId);
  
  if (!fset) {
    return res.status(500).json({ success: false, error: `Engine for floor ${fId} not initialized` });
  }

  // 1. Pick a single target node for this floor
  let targetNodeId: string | null = null;
  let targetZone: Zone | null = null;

  // Get currently active nodes across all zones on this floor
  const activeNodes = new Set<string>();
  for (const nodes of Object.values(fset.graphTickProcessor.getEpicenters())) {
    if (Array.isArray(nodes)) nodes.forEach(id => activeNodes.add(id));
  }

  // 2. Apply incident types to target nodes (different node for each type)
  const usedNodesInThisRequest = new Set<string>();
  const injectedNodes: string[] = [];

  for (const type of typesToInject) {
    let nodeToUse: string | null = null;
    let zoneToUse: Zone | null = null;

    if (type === 'active_shooter') {
      nodeToUse = 'F1_GROUND_N6';
      zoneToUse = 'D';
    } else if (nodeId && fset.graphTickProcessor.getGraphData().nodes.has(nodeId)) {
      nodeToUse = nodeId;
      const specificNode = fset.graphTickProcessor.getGraphData().nodes.get(nodeId);
      zoneToUse = specificNode ? (specificNode.parentZone as Zone) : zone;
    } else {
      // Selection criteria
      const candidates = Array.from(fset.graphTickProcessor.getGraphData().nodes.values()).filter(n => {
        const isAlreadyActive = activeNodes.has(n.id);
        const isUsedInThisLoop = usedNodesInThisRequest.has(n.id);
        if (isAlreadyActive || isUsedInThisLoop) return false;

        // Zone constraint (ignore if RANDOM)
        if (zone !== 'RANDOM' && n.parentZone !== zone) return false;

        return true;
      });

      if (candidates.length > 0) {
        const randomNode = candidates[Math.floor(Math.random() * candidates.length)];
        nodeToUse = randomNode.id;
        zoneToUse = (randomNode.parentZone as Zone) || 'A';
      } else {
        // ─── FALLBACK: Pick ANY node on this floor if zone-specific candidates are missing ───
        const allNodes = Array.from(fset.graphTickProcessor.getGraphData().nodes.values());
        const fallbackNodes = allNodes.filter(n => !activeNodes.has(n.id) && !usedNodesInThisRequest.has(n.id));
        
        const finalCandidates = fallbackNodes.length > 0 ? fallbackNodes : allNodes;
        if (finalCandidates.length > 0) {
          const randomNode = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
          nodeToUse = randomNode.id;
          zoneToUse = (randomNode.parentZone as Zone) || 'A';
          console.warn(`[INJECT] No specific nodes for zone ${zone} on Floor ${fId}. Falling back to Node ${nodeToUse} in Zone ${zoneToUse}.`);
        }
      }
    }

    if (!nodeToUse) {
      // If we couldn't even find a fallback node, fail
      console.error(`[INJECT] CRITICAL: No nodes at all found for injection on Floor ${fId}`);
      return res.status(400).json({ success: false, error: 'No nodes available on this floor' });
    }

    fset.graphTickProcessor.addEpicenter(zoneToUse!, nodeToUse!);
    fset.env.injectIncident(zoneToUse!, type);
    fset.stateMachine.trigger(zoneToUse!, type);

    // Inject into Cellular Automata grid
    const injectedNode = fset.graphTickProcessor.getGraphData().nodes.get(nodeToUse!);
    if (injectedNode) {
      fset.cellularAutomata.injectIncident(injectedNode.x, injectedNode.y, type);
    }
    
    usedNodesInThisRequest.add(nodeToUse);
    injectedNodes.push(nodeToUse);
    console.log(`[INJECT] ✅ ACTIVATED Floor ${fId}, Node ${nodeToUse}, Zone ${zoneToUse}, Type ${type}`);
  }

  if (fset.orchestrator.getSimulationMode() === 'stopped') {
    simulationMode = 'manual';
    fset.orchestrator.start('manual');
  }

  // Ensure master tick loop is running if we just injected something
  if (!masterTickInterval) {
    masterTickInterval = setInterval(() => runMasterTick(), 250);
    console.log('[SIM] Master tick loop started automatically via injection');
  }

  // Trigger immediate tick for instant feedback
  runMasterTick();

  res.json({ success: true, zone: targetZone, incidentTypes: typesToInject, floors: [fId] });
});


// ─── Resolve Incident (floor-aware) ──────────────────────────────────────────

app.post('/api/resolve', (req, res) => {
  const parsed = ResolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

  const { zone } = parsed.data;
  const floor = getFloor(req.body);
  const fset = floorEngines.get(floor)!;

  fset.stateMachine.resolveIncident(zone);
  fset.ble.deactivateZone(zone);
  fset.predictionEngine.clearZone(zone);

  const { floorPhysics, floorStates } = buildFloorSnapshot();
  io.emit('tick', { ...fset.orchestrator.getSnapshot(), floorCount: FLOOR_COUNT, floorPhysics, floorStates });

  res.json({ success: true, zone, floor });
});

// ─── Playbook ─────────────────────────────────────────────────────────────────

app.post('/api/playbook/complete', (req, res) => {
  const parsed = PlaybookCompleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

  const { actionId } = parsed.data;
  const floor = getFloor(req.body);
  const fset = floorEngines.get(floor)!;

  const action = fset.stateMachine.getPlaybook().find(a => a.id === actionId);
  fset.stateMachine.completePlaybookAction(actionId);
  if (action) fset.predictionEngine.mitigate(action.zone, action.incidentType);

  res.json({ success: true, actionId, floor });
});


// ─── Facility Config ──────────────────────────────────────────────────────────

app.get('/api/facility/config', (_req, res) => {
  try { res.json(configService.loadFacilityConfig()); }
  catch (err: unknown) { res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' }); }
});

app.put('/api/facility/dependencies', (req, res) => {
  try {
    const parsed = DependencyArraySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    configService.updateDependencies(parsed.data);
    for (const [, fset] of floorEngines) fset.predictionEngine.refreshDependencies();
    res.json({ success: true, count: parsed.data.length });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/facility/validate', (req, res) => {
  const result = DependencyArraySchema.safeParse(req.body);
  res.json({ valid: result.success, errors: result.success ? [] : result.error.issues });
});

app.post('/api/facility/reset', (_req, res) => {
  configService.resetToDefaults();
  for (const [, fset] of floorEngines) fset.predictionEngine.refreshDependencies();
  res.json({ success: true });
});

// ─── Faults (floor-aware) ─────────────────────────────────────────────────────

app.get('/api/faults', (req, res) => {
  const floor = getFloor(req.query);
  res.json(floorEngines.get(floor)!.faultManager.getState());
});

app.post('/api/faults/inject', (req, res) => {
  try {
    const floor = getFloor(req.body);
    const fset = floorEngines.get(floor)!;
    const input = FailureInjectionSchema.parse(req.body);
    const fault = fset.faultManager.inject(input, fset.orchestrator.getTickCount());
    sessionService.recordEvent('failure_injected', `${fault.subsystem}:${fault.mode}`, fset.orchestrator.getTickCount(), fault.targetZone, { faultId: fault.id, severity: fault.severity });
    res.json(fault);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid fault injection' });
  }
});

app.delete('/api/faults/:id', (req, res) => {
  const floor = getFloor(req.query);
  const fset = floorEngines.get(floor)!;
  const cleared = fset.faultManager.clear(req.params.id);
  if (!cleared) return res.status(404).json({ error: 'Fault not found' });
  sessionService.recordEvent('failure_cleared', req.params.id, fset.orchestrator.getTickCount());
  res.json({ success: true });
});

app.delete('/api/faults', (req, res) => {
  const floor = getFloor(req.query);
  const fset = floorEngines.get(floor)!;
  const count = fset.faultManager.clearAll();
  if (count > 0) sessionService.recordEvent('failure_cleared', `all (${count})`, fset.orchestrator.getTickCount());
  res.json({ success: true, cleared: count });
});

// ─── Evacuation (floor-aware) ─────────────────────────────────────────────────

app.post('/api/evacuation/start', (req, res) => {
  const floor = getFloor(req.body);
  const fset = floorEngines.get(floor)!;
  if (fset.evacuationEngine.isRunning()) return res.status(400).json({ error: 'Evacuation already in progress' });
  const people = fset.ble.getTrackedPeople();
  if (people.length === 0) return res.status(400).json({ error: 'No tracked people available' });
  fset.evacuationEngine.start(people, fset.orchestrator.getTickCount());
  sessionService.recordEvent('evacuation_started', `${people.length} agents`, fset.orchestrator.getTickCount());
  res.json({ success: true, agentCount: people.length, floor });
});

app.post('/api/evacuation/stop', (req, res) => {
  const floor = getFloor(req.body);
  const fset = floorEngines.get(floor)!;
  if (!fset.evacuationEngine.isRunning()) return res.status(400).json({ error: 'No evacuation in progress' });
  const metrics = fset.evacuationEngine.getMetrics(fset.orchestrator.getTickCount());
  fset.evacuationEngine.stop();
  sessionService.recordEvent('evacuation_completed', `${metrics?.evacuatedCount ?? 0} evacuated`, fset.orchestrator.getTickCount());
  res.json({ success: true, metrics, floor });
});

app.get('/api/evacuation', (req, res) => {
  const floor = getFloor(req.query);
  const fset = floorEngines.get(floor)!;
  res.json({
    active: fset.evacuationEngine.isRunning(),
    agents: fset.evacuationEngine.getAgents(),
    metrics: fset.evacuationEngine.getMetrics(fset.orchestrator.getTickCount()),
    floor,
  });
});

// ─── Dynamic Evacuation Route (Feature 2) ─────────────────────────────────────

app.post('/api/evacuation/route', (req, res) => {
  const floor = getFloor(req.body);
  const fset = floorEngines.get(floor)!;
  const graphData = fset.graphTickProcessor.getGraphData();

  const { startNodeId, startX, startY, personId, avoidDangerous } = req.body;

  // Determine start node
  let resolvedStartNode: string | null = startNodeId || null;

  if (!resolvedStartNode && personId) {
    // Find person's current node from BLE positions
    const positions = fset.ble.getAllPositions();
    const person = positions.find(p => p.id === personId);
    if (person?.currentNode) {
      resolvedStartNode = person.currentNode;
    } else if (person) {
      const { findNearestNode } = require('./map/graph');
      const nearest = findNearestNode(graphData, person.x, person.y);
      resolvedStartNode = nearest.id;
    }
  }

  if (!resolvedStartNode && startX != null && startY != null) {
    const { findNearestNode } = require('./map/graph');
    const nearest = findNearestNode(graphData, startX, startY);
    resolvedStartNode = nearest.id;
  }

  if (!resolvedStartNode) {
    return res.status(400).json({ error: 'Must provide startNodeId, personId, or (startX, startY)' });
  }

  // Verify start node exists
  if (!graphData.nodes.has(resolvedStartNode)) {
    return res.status(404).json({ error: `Node ${resolvedStartNode} not found on floor ${floor}` });
  }

  // Use existing pathfinding
  const { findNearestExit, isPathSafe } = require('./engine/pathfinding');

  const path = findNearestExit(
    resolvedStartNode,
    graphData.nodes,
    graphData.edges,
    graphData.zones,
    { avoidDangerous: avoidDangerous ?? true }
  );

  if (!path || path.length === 0) {
    // Count blocked exits for the response
    const allExits = Array.from(graphData.nodes.values()).filter((n: any) => n.isExit);
    return res.json({
      path: [],
      exitNodeId: null,
      pathCoordinates: [],
      totalCost: Infinity,
      estimatedTimeSec: Infinity,
      riskScore: 100,
      blockedAlternatives: allExits.length,
      timestamp: Date.now(),
    });
  }

  // Build response
  const exitNodeId = path[path.length - 1];
  const pathCoordinates = path.map((nodeId: string) => {
    const node = graphData.nodes.get(nodeId)!;
    return { x: node.x, y: node.y, nodeId };
  });

  // Calculate total cost
  let totalCost = 0;
  let maxRisk = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const nodeEdges = graphData.edges.get(path[i]) ?? [];
    const edge = nodeEdges.find((e: any) => e.to === path[i + 1]);
    if (edge) totalCost += edge.weight;

    const node = graphData.nodes.get(path[i]);
    if (node) {
      const zone = graphData.zones.get(node.zoneId);
      if (zone && zone.riskLevel > maxRisk) maxRisk = zone.riskLevel;
    }
  }

  // Count blocked alternatives
  const allExits = Array.from(graphData.nodes.values()).filter((n: any) => n.isExit);
  let blockedAlternatives = 0;
  for (const exit of allExits) {
    if ((exit as any).id === exitNodeId) continue;
    const altPath = findNearestExit(resolvedStartNode, graphData.nodes, graphData.edges, graphData.zones, { avoidDangerous: true });
    if (!altPath) blockedAlternatives++;
  }

  res.json({
    path,
    exitNodeId,
    pathCoordinates,
    totalCost,
    estimatedTimeSec: Math.round(totalCost * 5), // ~5 sec per unit cost
    riskScore: maxRisk,
    blockedAlternatives,
    timestamp: Date.now(),
  });
});

// ─── ICS Task Board (Feature 3) ───────────────────────────────────────────────

app.get('/api/tasks', (_req, res) => {
  res.json(taskBoardService.getBoard());
});

app.get('/api/tasks/:id', (req, res) => {
  const task = taskBoardService.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const { title, description, category, priority, targetZone, targetFloor, createdBy } = req.body;
  if (!title || !category || !priority || !createdBy) {
    return res.status(400).json({ error: 'title, category, priority, and createdBy are required' });
  }
  const task = taskBoardService.createTask({
    title,
    description: description || '',
    category,
    priority,
    targetZone,
    targetFloor,
    createdBy,
  });
  io.emit('ics:task_created', task);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id/status', (req, res) => {
  const { status, actor } = req.body;
  if (!status || !actor) return res.status(400).json({ error: 'status and actor required' });
  const task = taskBoardService.updateStatus(req.params.id, status, actor);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  io.emit('ics:task_updated', task);
  res.json(task);
});

app.patch('/api/tasks/:id/assign', (req, res) => {
  const { unitName, actor } = req.body;
  if (!unitName || !actor) return res.status(400).json({ error: 'unitName and actor required' });
  const task = taskBoardService.assignUnit(req.params.id, unitName, actor);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  io.emit('ics:task_updated', task);
  res.json(task);
});

app.patch('/api/tasks/:id/priority', (req, res) => {
  const { priority, actor } = req.body;
  if (!priority || !actor) return res.status(400).json({ error: 'priority and actor required' });
  const task = taskBoardService.updatePriority(req.params.id, priority, actor);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  io.emit('ics:task_updated', task);
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const deleted = taskBoardService.deleteTask(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
  io.emit('ics:task_deleted', { id: req.params.id });
  res.json({ success: true });
});

app.get('/api/tasks/:id/audit', (req, res) => {
  const task = taskBoardService.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task.auditLog);
});

// ─── Reports ──────────────────────────────────────────────────────────────────

app.post('/api/reports/generate', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const session = sessionService.getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const floor = getFloor(req.body);
    const fset = floorEngines.get(floor)!;
    const report = reportService.generate(session, fset.stateMachine.getPlaybook(), fset.faultManager.getState(), fset.evacuationEngine.getMetrics(fset.orchestrator.getTickCount()));
    res.json(report);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Report generation failed' });
  }
});

app.get('/api/reports', (_req, res) => res.json(reportService.listReports()));
app.get('/api/reports/:id', (req, res) => {
  const report = reportService.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});
app.delete('/api/reports/:id', (req, res) => {
  const deleted = reportService.deleteReport(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Report not found' });
  res.json({ success: true });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', (_req, res) => res.json(sessionService.listSessions()));
app.get('/api/sessions/:id', (req, res) => {
  const session = sessionService.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// ─── Snapshot ─────────────────────────────────────────────────────────────────

app.get('/api/snapshot', (_req, res) => {
  const { floorPhysics, floorStates } = buildFloorSnapshot();
  res.json({
    tick: orchestrator.getTickCount(),
    mode: orchestrator.getSimulationMode(),
    floorCount: FLOOR_COUNT,
    floorPhysics,
    floorStates,
    // floor 1 data for backward compat
    zonePhysics: env.getAllPhysics(),
    zoneStates: stateMachine.getAllStates(),
    blePositions: ble.getAllPositions(),
    bleActive: ble.getActiveZones(),
    events: (() => {
      let evs: any[] = [];
      for (const [, fset] of floorEngines) evs.push(...fset.stateMachine.getRecentEvents(200));
      return evs.sort((a, b) => a.timestamp - b.timestamp);
    })(),
    playbook: stateMachine.getPlaybook(),
    populationByZone: ble.getPopulationByZone(),
  });
});

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[WS] Dashboard connected: ${socket.id}`);
  try {
    const { floorPhysics, floorStates } = buildFloorSnapshot();
    console.log(`[WS] Snapshot built, emitting to ${socket.id}`);
    const snap = orchestrator.getSnapshot();
    socket.emit('snapshot', { ...snap, floorCount: FLOOR_COUNT, floorPhysics, floorStates });
    console.log(`[WS] Snapshot emitted successfully to ${socket.id}`);
  } catch (err) {
    console.error(`[WS] ERROR during connection snapshot:`, err);
  }
  socket.on('disconnect', () => console.log(`[WS] Dashboard disconnected: ${socket.id}`));
});

// ─── Startup ──────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CrisisSync — Unified Command & Control API (Multi-Floor)');
  console.log('═══════════════════════════════════════════════════════════════');
  const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'http://127.0.0.1:8000';
  console.log(`  🌐 REST API:     http://127.0.0.1:${PORT}/api/health`);
  console.log(`  📡 Socket.io:    ws://127.0.0.1:${PORT}`);
  console.log(`  🏢 Floors:       ${FLOOR_COUNT}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
});

function shutdown() {
  console.log('\n[Server] Shutting down...');
  for (const [, fset] of floorEngines) fset.orchestrator.stop();
  server.close(() => { console.log('[Server] Closed.'); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, server, io };
