'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';

// ─── Types (from shared monorepo package) ─────────────────────────────────────
import type {
  Zone, SystemPhase, SensorType, IncidentType, SimulationMode, EventSeverity,
  ZonePhysics, ZoneIncidentState, SensorReading, EstimatedPosition,
  SystemEvent, PlaybookAction, TickPayload, TickPayloadDelta, Prediction, PredictionV2, PredictionExplanation,
  EvacuationAgent, EvacuationMetrics, GraphState, CrisisEvent,
} from '@crisis/types';
import { DEFAULT_PHYSICS } from '@crisis/types';

export type {
  Zone, SystemPhase, SensorType, IncidentType, SimulationMode, EventSeverity,
  ZonePhysics, ZoneIncidentState, SensorReading, EstimatedPosition,
  SystemEvent, PlaybookAction, TickPayload, Prediction, PredictionV2, PredictionExplanation,
  EvacuationAgent, EvacuationMetrics, GraphState, CrisisEvent,
};

// ─── Store ────────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface CrisisStore {
  connected: boolean;
  tick: number;
  simulationMode: SimulationMode;
  zonePhysics: Record<Zone, ZonePhysics>;
  zoneStates: Record<Zone, ZoneIncidentState>;
  sensorReadings: SensorReading[];
  blePositions: EstimatedPosition[];
  bleActive: Zone[];
  events: SystemEvent[];
  playbook: PlaybookAction[];
  predictions: Prediction[];
  evacuationAgents: EvacuationAgent[];
  evacuationMetrics: EvacuationMetrics | null;
  evacuationActive: boolean;
  graphState: GraphState | null;
  floorGraphs: Record<number, GraphState>;
  floorEpicenters: Record<number, Record<Zone, string[]>>;
  crisisEvents: CrisisEvent[];
  restrictedZone?: Zone;
  error: string | null;
  currentFloor: number;
  floorCount: number;
  lastTickTime: number | null;
}

const DEFAULT_STATE: ZoneIncidentState = {
  zone: 'A', phase: 'STANDBY', incidentType: null,
  activeIncidents: [],
  triggeredAt: null, confirmedAt: null, bleActiveAt: null,
  cvRequestedAt: null, cvTimeoutMs: 10000, confidence: 0,
};

// ─── External Store (useSyncExternalStore-compatible) ─────────────────────────

let storeVersion = 0;
const listeners = new Set<() => void>();

let store: CrisisStore = {
  connected: false,
  tick: 0,
  simulationMode: 'stopped',
  zonePhysics: {},
  zoneStates: {},
  sensorReadings: [],
  blePositions: [],
  bleActive: [],
  events: [],
  playbook: [],
  predictions: [],
  evacuationAgents: [],
  evacuationMetrics: null,
  evacuationActive: false,
  graphState: null,
  floorGraphs: {},
  floorEpicenters: {},
  crisisEvents: [],
  restrictedZone: undefined,
  error: null,
  currentFloor: 1,
  floorCount: 3,
  lastTickTime: null,
};

function notify() {
  listeners.forEach(fn => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return store;
}

function getServerSnapshot() {
  return store;
}

// ─── React Hook (useSyncExternalStore — Fix #5) ──────────────────────────────

export function useCrisisStore(): CrisisStore {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCrisisStoreSelector<T>(selector: (state: CrisisStore) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(store),
    () => selector(store)
  );
}

// ─── Socket Connection ───────────────────────────────────────────────────────

let socket: Socket | null = null;

export function useSocket() {
  useEffect(() => {
    if (socket) return;
    const s = io(API_URL, { transports: ['websocket', 'polling'] });
    socket = s;

    s.on('connect', () => {
      store.connected = true;
      store.error = null;
      notify();
    });

    s.on('disconnect', () => {
      store.connected = false;
      notify();
    });

    s.on('tick', (data: TickPayloadDelta) => {
      store.lastTickTime = Date.now();
      // Use floor-specific data if available in the payload, matching current floor
      const floorPhysics = (data as any).floorPhysics?.[store.currentFloor];
      const floorStates = (data as any).floorStates?.[store.currentFloor];
      const physics = floorPhysics || data.zonePhysics;
      const states = floorStates || data.zoneStates;

      // Accumulate events: merge incoming events with existing, deduplicate by ID
      let mergedEvents = store.events;
      if (data.events && data.events.length > 0) {
        // Create a map of all unique events by ID (latest wins)
        const eventMap = new Map<string, SystemEvent>();
        
        // Add existing events to the map
        store.events.forEach(e => eventMap.set(e.id, e));
        
        // Add new events (will overwrite if ID already exists, preventing duplicates)
        data.events.forEach(e => eventMap.set(e.id, e));
        
        // Convert back to array and sort by timestamp
        mergedEvents = Array.from(eventMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        
        // Cap at 500 to prevent memory bloat
        if (mergedEvents.length > 500) {
          mergedEvents = mergedEvents.slice(-500);
        }
      }
      
      const fGraphs = (data as any).floorGraphs;

      store = {
        ...store,
        tick: data.tick,
        simulationMode: data.simulationMode ?? store.simulationMode,
        zonePhysics: physics ? { ...store.zonePhysics, ...physics } : store.zonePhysics,
        zoneStates: states ? { ...store.zoneStates, ...states } : store.zoneStates,
        sensorReadings: data.sensorReadings ?? store.sensorReadings,
        blePositions: data.blePositions ?? store.blePositions,
        bleActive: data.bleActive ?? store.bleActive,
        events: mergedEvents,
        playbook: data.playbook ?? store.playbook,
        predictions: data.predictions || store.predictions,
        evacuationAgents: data.evacuationAgents || store.evacuationAgents,
        evacuationMetrics: data.evacuationMetrics !== undefined ? data.evacuationMetrics : store.evacuationMetrics,
        evacuationActive: data.evacuationActive ?? store.evacuationActive,
        floorGraphs: fGraphs ? { ...store.floorGraphs, ...fGraphs } : store.floorGraphs,
        floorEpicenters: (data as any).floorEpicenters || store.floorEpicenters,
        graphState: (fGraphs?.[store.currentFloor]) || data.graphState || store.graphState,
        crisisEvents: data.crisisEvents || store.crisisEvents,
        restrictedZone: data.restrictedZone ?? store.restrictedZone,
      };
      notify();
    });

    s.on('snapshot', (data: any) => {
      const fCount = data.floorCount || store.floorCount || 1;
      const fPhysics = data.floorPhysics?.[store.currentFloor] || data.zonePhysics;
      const fStates = data.floorStates?.[store.currentFloor] || data.zoneStates;

      store = {
        ...store,
        tick: data.tick || 0,
        simulationMode: data.simulationMode || 'stopped',
        zonePhysics: fPhysics || store.zonePhysics,
        zoneStates: fStates || store.zoneStates,
        sensorReadings: data.sensorReadings || [],
        blePositions: data.blePositions || [],
        bleActive: data.bleActive || [],
        events: data.events || [],
        playbook: data.playbook || [],
        predictions: data.predictions || [],
        evacuationAgents: data.evacuationAgents || [],
        evacuationMetrics: data.evacuationMetrics ?? null,
        evacuationActive: data.evacuationActive ?? false,
        graphState: data.floorGraphs?.[store.currentFloor] || data.graphState || store.graphState,
        floorGraphs: data.floorGraphs || store.floorGraphs,
        floorEpicenters: data.floorEpicenters || store.floorEpicenters,
        crisisEvents: data.crisisEvents || [],
        restrictedZone: data.restrictedZone,
        floorCount: fCount,
      };
      notify();
    });

    // Singleton socket — don't disconnect on React strict-mode remount
  }, []);
}

// ─── API Actions (with error handling — Fix #10) ──────────────────────────────

function setError(msg: string) {
  store = { ...store, error: msg };
  notify();
  // Auto-clear after 5 seconds
  setTimeout(() => {
    if (store.error === msg) {
      store = { ...store, error: null };
      notify();
    }
  }, 5000);
}

export function setCurrentFloor(floor: number) {
  store = { 
    ...store, 
    currentFloor: floor,
    graphState: store.floorGraphs[floor] || store.graphState
  };
  notify();
}

export async function startSimulation(mode: SimulationMode = 'auto') {
  try {
    const res = await fetch(`${API_URL}/api/simulation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    store = {
      ...store,
      simulationMode: mode,
      error: null
    };
    notify();
  } catch (err) {
    setError(`Failed to start simulation: ${err instanceof Error ? err.message : 'connection refused'}`);
  }
}

export async function stopSimulation() {
  try {
    const res = await fetch(`${API_URL}/api/simulation/stop`, { method: 'POST' });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    store = {
      ...store,
      simulationMode: 'stopped',
      tick: 0,
      sensorReadings: [],
      blePositions: [],
      bleActive: [],
      events: [],
      playbook: [],
      predictions: [],
      error: null,
      crisisEvents: [],
      zonePhysics: {},
      zoneStates: {},
    };
    notify();
  } catch (err) {
    setError(`Failed to stop simulation: ${err instanceof Error ? err.message : 'connection refused'}`);
  }
}

export async function injectIncident(zone: Zone, incidentType: IncidentType) {
  try {
    const res = await fetch(`${API_URL}/api/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone, incidentType }),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    setError(`Failed to inject incident: ${err instanceof Error ? err.message : 'connection refused'}`);
  }
}

export async function resolveIncident(zone: Zone) {
  try {
    const res = await fetch(`${API_URL}/api/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone }),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    setError(`Failed to resolve incident: ${err instanceof Error ? err.message : 'connection refused'}`);
  }
}

export async function completePlaybookAction(actionId: string) {
  try {
    const res = await fetch(`${API_URL}/api/playbook/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    setError(`Failed to complete action: ${err instanceof Error ? err.message : 'connection refused'}`);
  }
}
