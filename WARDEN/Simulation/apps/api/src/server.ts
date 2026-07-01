// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Unified API Server (Multi-Floor)
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { setupSimulationRoutes } from './routes/simulation';
import { setupFacilityRoutes } from './routes/facility';
import { setupFaultsRoutes } from './routes/faults';
import { setupEvacuationRoutes } from './routes/evacuation';
import { setupTasksRoutes } from './routes/tasks';
import { setupReportsRoutes } from './routes/reports';
import { setupSessionsRoutes } from './routes/sessions';
import { setupPredictionsRoutes } from './routes/predictions';

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


app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    tick: orchestrator.getTickCount(),
    mode: orchestrator.getSimulationMode(),
    cvAvailable: f1.cvBridge.getAvailability(),
    floorCount: FLOOR_COUNT,
  });
});

// ─── Modular Routes Setup ─────────────────────────────────────────────────────
const context = {
  floorEngines, sessionService, io, FLOOR_COUNT, ALL_FLOORS, configService, reportService, taskBoardService,
  buildFloorSnapshot, runMasterTick: () => runMasterTick(), 
  setSimulationMode: (m: any) => { simulationMode = m; }, 
  getSimulationMode: () => simulationMode, 
  setMasterTickInterval: (i: any) => { masterTickInterval = i; }, 
  getMasterTickInterval: () => masterTickInterval, 
  globalAutoSimulator, f1
};

app.use('/api', setupPredictionsRoutes(context));
app.use('/api', setupSimulationRoutes(context));
app.use('/api', setupFacilityRoutes(context));
app.use('/api', setupFaultsRoutes(context));
app.use('/api', setupEvacuationRoutes(context));
app.use('/api', setupTasksRoutes(context));
app.use('/api', setupReportsRoutes(context));
app.use('/api', setupSessionsRoutes(context));

// ─── Master Simulation Loop ──────────────────────────────────────────────────
let masterTickInterval: NodeJS.Timeout | null = null;
let masterTickCount = 0;
let simulationMode: SimulationMode = 'stopped';

async function runMasterTick() {
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
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
  fetch(`${backendUrl}/api/simulation/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tickPayload),
    signal: AbortSignal.timeout(1000)
  }).catch(err => {
    // Silent fail if backend is down to avoid crashing sim
  });
}

// ─── Master Loop and Routes Loaded ────────────────────────────────────────────

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
