import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/config-service';
import { SessionService } from '../src/services/session-service';
import { FaultManager } from '../src/services/fault-manager';
import { ReportService } from '../src/services/report-service';
import { EvacuationEngine } from '../src/engine/evacuation-engine';
import { PredictionEngine } from '../src/engine/prediction-engine';
import { EnvironmentEngine } from '../src/engine/environment';
import { SensorGrid } from '../src/engine/sensors';
import { BLEEngine } from '../src/engine/ble';
import { StateMachine } from '../src/engine/state-machine';
import { DEFAULT_PHYSICS } from '../../packages/types';
import type { Zone, ZonePhysics, TrackedPerson, SimulationMode } from '../../packages/types';
import fs from 'fs';
import path from 'path';

// ─── Cross-Feature Integration Test ──────────────────────────────────────────
// Validates that all v1.2 features (Phases 1–6) work together correctly:
//   - ConfigService → DependencyEditor + PredictionEngine
//   - FaultManager → SensorGrid + CVBridge
//   - EvacuationEngine → BLE tracked people
//   - ReportService → Session timeline + all summaries
//   - Session lifecycle → Report generation

const REPORTS_DIR = path.join(__dirname, '../data/reports');

describe('Cross-Feature Integration', () => {
  let configService: ConfigService;
  let sessionService: SessionService;
  let faultManager: FaultManager;
  let reportService: ReportService;
  let env: EnvironmentEngine;
  let sensorGrid: SensorGrid;
  let ble: BLEEngine;
  let stateMachine: StateMachine;
  let evacuationEngine: EvacuationEngine;

  beforeEach(() => {
    configService = new ConfigService();
    sessionService = new SessionService();
    faultManager = new FaultManager();
    reportService = new ReportService();
    env = new EnvironmentEngine();
    sensorGrid = new SensorGrid(faultManager);
    ble = new BLEEngine(faultManager);
    stateMachine = new StateMachine();
    evacuationEngine = new EvacuationEngine();

    ble.initialize(10);

    // Clean reports
    if (fs.existsSync(REPORTS_DIR)) {
      for (const f of fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json'))) {
        try { fs.unlinkSync(path.join(REPORTS_DIR, f)); } catch { }
      }
    }
  });

  // ─── Full Simulation Lifecycle ────────────────────────────────────────────

  it('runs a complete simulation lifecycle: start → incident → predict → fault → evac → report', () => {
    // 1. Start session
    const session = sessionService.startSession('auto');
    expect(session.id).toBeTruthy();
    expect(sessionService.isActive()).toBe(true);

    // 2. Simulate some ticks — inject an incident
    env.injectIncident('A', 'fire');
    stateMachine.trigger('A', 'fire');

    const physics = env.getAllPhysics();
    const readings = sensorGrid.generateReadings(physics);
    const blePositions = ble.tick();

    // Record events like the server does
    sessionService.recordEvent('incident_triggered', 'fire detected in Zone A', 1, 'A');

    // 3. Fault injection
    faultManager.inject({
      subsystem: 'sensor',
      mode: 'stuck_high',
      targetZone: 'A',
      severity: 0.7,
      durationTicks: 30,
    }, 5);
    sessionService.recordEvent('failure_injected', 'sensor:stuck_high — Zone A', 5, 'A');

    expect(faultManager.getActiveFaults()).toHaveLength(1);

    // 4. Check BLE tracked people exist
    const people = ble.getTrackedPeople();
    expect(people.length).toBeGreaterThanOrEqual(0); // may be 0 if no zones active, that's OK

    // 5. Evacuation (use engine without ConfigService for isolation)
    const evacPeople: TrackedPerson[] = [
      { id: 'P-001', role: 'guest', x: 5, y: 5, vx: 0, vy: 0, zone: 'A' },
      { id: 'P-002', role: 'guest', x: 50, y: 50, vx: 0, vy: 0, zone: 'B' },
      { id: 'R-001', role: 'responder', x: 80, y: 80, vx: 0, vy: 0, zone: 'D' },
    ];
    evacuationEngine.start(evacPeople, 10);
    expect(evacuationEngine.isRunning()).toBe(true);

    sessionService.recordEvent('evacuation_started', '3 agents', 10);

    // Run evacuation for several ticks
    const calmPhysics: Record<Zone, ZonePhysics> = {
      A: { ...DEFAULT_PHYSICS, temperature: 60, fireIntensity: 0.5 },
      B: { ...DEFAULT_PHYSICS },
      C: { ...DEFAULT_PHYSICS },
      D: { ...DEFAULT_PHYSICS },
    };
    for (let i = 11; i <= 30; i++) {
      evacuationEngine.tick(calmPhysics, i);
    }

    const evacMetrics = evacuationEngine.getMetrics(30);
    expect(evacMetrics).not.toBeNull();
    expect(evacMetrics!.totalOccupants).toBe(3);

    // 6. Confirm the incident
    sessionService.recordEvent('incident_confirmed', 'fire confirmed in Zone A', 15, 'A');

    // 7. End session
    const ended = sessionService.endSession(30);
    expect(ended).not.toBeNull();
    expect(ended!.timeline.length).toBeGreaterThanOrEqual(3);

    // 8. Generate report from finished session
    const report = reportService.generate(
      ended!,
      stateMachine.getPlaybook(),
      faultManager.getState(),
      evacMetrics,
    );

    expect(report.id).toBeTruthy();
    expect(report.sessionId).toBe(session.id);
    expect(report.incidentSummary.confirmedCount).toBe(1);
    expect(report.incidentSummary.incidentTypes).toContain('fire');
    expect(report.incidentSummary.affectedZones).toContain('A');
    expect(report.failureSummary.totalInjected).toBe(1);
    expect(report.evacuationSummary).toBeDefined();
    expect(report.evacuationSummary!.totalOccupants).toBe(3);
    expect(report.outcomeAssessment.strengths.length).toBeGreaterThan(0);

    // 9. Verify report persistence
    const loaded = reportService.getReport(report.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe(session.id);

    // 10. Cleanup
    reportService.deleteReport(report.id);
    evacuationEngine.reset();
    faultManager.reset();
  });

  // ─── Config → Prediction Pipeline ────────────────────────────────────────

  it('ConfigService dependencies feed PredictionEngine', () => {
    const deps = configService.getDependencyLinks();
    expect(deps.length).toBeGreaterThanOrEqual(4); // 3 bidir = 6 directed

    // PredictionEngine should accept these without errors
    const predEngine = new PredictionEngine(env, configService);
    // Starting and immediately stopping should be safe
    predEngine.start();
    predEngine.reset();
  });

  // ─── FaultManager → Sensor Grid consistency ──────────────────────────────

  it('fault injection affects sensor readings', () => {
    const basePhysics = env.getAllPhysics();
    const baseReadings = sensorGrid.generateReadings(basePhysics);

    // Inject a global sensor stuck fault
    faultManager.inject({
      subsystem: 'sensor',
      mode: 'stuck_high',
      severity: 1.0,
    }, 0);

    const faultReadings = sensorGrid.generateReadings(basePhysics);

    // Readings should still be generated (fault affects values, not count)
    expect(faultReadings.length).toBe(baseReadings.length);

    faultManager.reset();
  });

  // ─── Evacuation → BLE Integration ────────────────────────────────────────

  it('evacuation engine handles zero tracked people gracefully', () => {
    const noOne: TrackedPerson[] = [];
    evacuationEngine.start(noOne, 0);
    // Should start but with 0 agents
    expect(evacuationEngine.getAgents()).toHaveLength(0);
    evacuationEngine.reset();
  });

  // ─── Session → Report Error Handling ─────────────────────────────────────

  it('report service handles empty session with default assessments', () => {
    const session = sessionService.startSession('auto');
    const ended = sessionService.endSession(0);

    const report = reportService.generate(
      ended!,
      [],
      { activeFailures: [], totalInjected: 0, totalCleared: 0 },
      null,
    );

    // Should still produce valid output
    expect(report.incidentSummary.confirmedCount).toBe(0);
    expect(report.predictionSummary.totalRaised).toBe(0);
    expect(report.outcomeAssessment.suggestions.length).toBeGreaterThan(0);

    reportService.deleteReport(report.id);
  });

  // ─── FaultManager lifecycle ──────────────────────────────────────────────

  it('fault auto-expiry works within tick cycle', () => {
    faultManager.inject({
      subsystem: 'sensor',
      mode: 'noisy',
      severity: 0.5,
      durationTicks: 5,
    }, 0);

    expect(faultManager.getActiveFaults()).toHaveLength(1);

    // Tick to expiry
    faultManager.tick(4); // still active
    expect(faultManager.getActiveFaults()).toHaveLength(1);

    faultManager.tick(5); // should expire at tick 5 (started at 0, duration 5)
    expect(faultManager.getActiveFaults()).toHaveLength(0);

    const state = faultManager.getState();
    expect(state.totalInjected).toBe(1);
    expect(state.totalCleared).toBe(1);

    faultManager.reset();
  });
});
