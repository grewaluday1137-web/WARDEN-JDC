// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Shared Type Definitions
// All types used across API, Frontend, and CV Engine
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Zone System ──────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Floor System ─────────────────────────────────────────────────────────────

export const FLOOR_COUNT = 3;
export type FloorId = 1 | 2 | 3;
export const ALL_FLOORS: FloorId[] = [1, 2, 3];
export const FLOOR_LABELS: Record<FloorId, string> = {
  1: 'Floor 1 — Ground',
  2: 'Floor 2 — Mid',
  3: 'Floor 3 — Top',
};
export const FloorSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const ZoneSchema = z.string();
export type Zone = string;

export interface ZoneBounds {
  x1: number; y1: number;
  x2: number; y2: number;
}

export const ZONE_BOUNDS: Record<string, ZoneBounds> = {
  A: { x1: 0, y1: 0, x2: 50, y2: 50 },
  B: { x1: 50, y1: 0, x2: 100, y2: 50 },
  C: { x1: 0, y1: 50, x2: 50, y2: 100 },
  D: { x1: 50, y1: 50, x2: 100, y2: 100 },
};

export const ZONE_COLORS: Record<string, string> = {
  A: '#00e5ff', // Cyan
  B: '#ff9100', // Amber
  C: '#76ff03', // Lime
  D: '#e040fb', // Purple
};

export const ZONE_LABELS: Record<string, string> = {
  A: 'Zone A — NW Sector',
  B: 'Zone B — NE Sector',
  C: 'Zone C — SW Sector',
  D: 'Zone D — SE Sector',
};

// ─── 4-Stage Pinpoint Protocol ────────────────────────────────────────────────

export type SystemPhase = 'STANDBY' | 'TRIGGERED' | 'CONFIRMING' | 'CONFIRMED' | 'PINPOINT' | 'MANUAL_REVIEW';

export interface ZoneIncidentState {
  zone: Zone;
  phase: SystemPhase;
  incidentType: IncidentType | null;
  activeIncidents: IncidentType[];
  triggeredAt: number | null;
  confirmedAt: number | null;
  bleActiveAt: number | null;
  cvRequestedAt: number | null;
  cvTimeoutMs: number;
  confidence: number;
}

// ─── Sensor Types ─────────────────────────────────────────────────────────────

export type SensorType = 'temperature' | 'smoke' | 'gas' | 'vibration' | 'flame' | 'sprinkler' | 'water_leak' | 'energy_meter' | 'elevator';
export type IncidentType = 
  | 'fire' | 'explosion' | 'gas_leak' | 'structural_collapse'
  | 'medical_emergency' | 'security_breach' | 'active_shooter' 
  | 'power_outage';

export interface SensorReading {
  sensorId: string;
  zoneId: Zone;
  nodeId?: string;
  type: SensorType;
  value: number;
  unit: string;
  timestamp: number;
  isAnomalous: boolean;
  floor?: number;
}

// ─── Zone Physics (Ground Truth) ──────────────────────────────────────────────

export interface ZonePhysics {
  temperature: number;      // °C
  smokeDensity: number;     // % (0–100)
  gasLevel: number;         // ppm CO equivalent
  vibration: number;        // g-force
  fireIntensity: number;    // 0–1
  structuralIntegrity: number; // 0–1 (1 = intact)
  stress: number;           // 0–1 (structural load/stress propagation)
  heatRisk: number;         // 0–1 (local ignition probability factor)
  sprinklerStatus: 'idle' | 'active' | 'faulty'; // Auto-deploy
  waterLeak: number;        // % leak volume
  energyUsage: number;      // kW current draw
  elevatorOccupancy: number; // 0-1 fraction occupied
  elevatorStatus: 'normal' | 'warning' | 'jammed' | 'faulty';
}

export const DEFAULT_PHYSICS: ZonePhysics = {
  temperature: 22,
  smokeDensity: 0,
  gasLevel: 5,
  vibration: 0.02,
  fireIntensity: 0,
  structuralIntegrity: 1.0,
  stress: 0,
  heatRisk: 0,
  sprinklerStatus: 'idle',
  waterLeak: 0,
  energyUsage: 50, // nominal
  elevatorOccupancy: 0.1, // mostly empty
  elevatorStatus: 'normal',
};

// ─── BLE Positioning ──────────────────────────────────────────────────────────

export type PersonRole = 'guest' | 'staff' | 'responder';

export interface Beacon {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface ResponderTelemetry {
  heartRate: number;    // bpm (e.g., 60-180)
  oxygenLevel: number;  // % (0-100)
  stressLevel: number;  // 0-1
  isCritical: boolean;
}

export interface TrackedPerson {
  id: string;
  role: PersonRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  zone: Zone;
  telemetry?: ResponderTelemetry;
}

export interface EstimatedPosition {
  id: string;
  role: PersonRole;
  x: number;
  y: number;
  zone: Zone;
  timestamp: number;
  currentNode?: string;
  floor?: number;
  telemetry?: ResponderTelemetry;
}

// ─── Computer Vision ──────────────────────────────────────────────────────────

export interface CVAnalysisRequest {
  zoneId: Zone;
  incidentType: IncidentType;
  timestamp: number;
}

export interface CVAnalysisResult {
  zoneId: Zone;
  confirmed: boolean;
  confidence: number;
  detectionType: string;
  signals: string[];
  timestamp: number;
}

// ─── Event Log ────────────────────────────────────────────────────────────────

export type EventSeverity = 'info' | 'warning' | 'critical' | 'resolved';

export interface SystemEvent {
  id: string;
  timestamp: number;
  zone: Zone | null;
  severity: EventSeverity;
  source: 'sensor' | 'cv-engine' | 'ble' | 'state-machine' | 'operator';
  message: string;
  data?: Record<string, unknown>;
  floor?: number;
}

// ─── Action Playbook ──────────────────────────────────────────────────────────

export interface PlaybookAction {
  id: string;
  incidentType: IncidentType;
  zone: Zone;
  step: number;
  label: string;
  completed: boolean;
  timestamp: number;
}

// ─── Simulation Control ───────────────────────────────────────────────────────

export const SimModeSchema = z.enum(['auto', 'manual']);
export type SimulationMode = 'stopped' | 'auto' | 'manual';

export const IncidentTypeSchema = z.enum([
  'fire', 'explosion', 'gas_leak', 'structural_collapse',
  'medical_emergency', 'security_breach', 'active_shooter',
  'power_outage'
]);
export const InjectSchema = z.object({ 
  zone: ZoneSchema, 
  incidentType: z.union([IncidentTypeSchema, z.array(IncidentTypeSchema)]), 
  floor: z.union([FloorSchema, z.array(FloorSchema)]).optional(),
  nodeId: z.string().optional()
});
export const ResolveSchema = z.object({ zone: ZoneSchema, floor: FloorSchema.optional() });
export const PlaybookCompleteSchema = z.object({ actionId: z.string().min(1) });
export const StartSimSchema = z.object({ mode: SimModeSchema }).optional();

export interface ManualInjection {
  zone: Zone;
  incidentType: IncidentType;
}

// ─── Predictive Cascade System ────────────────────────────────────────────────

export type DependencyType = 'gas' | 'structural' | 'electric';

export interface DependencyLink {
  sourceZone: Zone;
  targetZone: Zone;
  linkType: DependencyType;
  weight: number; // 0–1, higher = stronger coupling
}

export interface Prediction {
  id: string;
  zone: Zone;
  incidentType: IncidentType;
  confidence: number;   // 0–1
  eta: number;          // estimated seconds until cascade
  reasoning: string;    // human-readable explanation
  sourceZone: Zone;     // originating zone for cascade
  sourceIncident: IncidentType; // originating incident
  linkType: DependencyType;    // dependency path
  floor?: number;
}

// ─── Facility Configuration ───────────────────────────────────────────────────

export interface DependencyLinkConfig {
  id: string;
  sourceZone: Zone;
  targetZone: Zone;
  linkType: DependencyType;
  weight: number;        // 0–1
  bidirectional: boolean;
  label?: string;
}

export const DependencyLinkConfigSchema = z.object({
  id: z.string().min(1),
  sourceZone: ZoneSchema,
  targetZone: ZoneSchema,
  linkType: z.enum(['gas', 'structural', 'electric']),
  weight: z.number().min(0).max(1),
  bidirectional: z.boolean(),
  label: z.string().optional(),
}).refine(d => d.sourceZone !== d.targetZone, {
  message: 'Self-links are not allowed',
});

export const DependencyArraySchema = z.array(DependencyLinkConfigSchema);

export interface ExitNode {
  id: string;
  zone: Zone;
  x: number;
  y: number;
  label: string;
  capacity: number;
  blocked: boolean;
}

export const ExitNodeSchema = z.object({
  id: z.string().min(1),
  zone: ZoneSchema,
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  label: z.string().min(1),
  capacity: z.number().min(1),
  blocked: z.boolean(),
});

export interface RouteEdge {
  from: string;
  to: string;
  travelTimeTicks: number;
  hazardMultiplier: number;
}

export const RouteEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  travelTimeTicks: z.number().min(1),
  hazardMultiplier: z.number().min(0),
});

export interface FacilityConfig {
  version: number;
  zones: Zone[];
  dependencies: DependencyLinkConfig[];
  exits: ExitNode[];
  routes: RouteEdge[];
  metadata: {
    facilityName: string;
    lastModified: string;
    author: string;
  };
}

export const FacilityConfigSchema = z.object({
  version: z.number().int().min(1),
  zones: z.array(ZoneSchema),
  dependencies: DependencyArraySchema,
  exits: z.array(ExitNodeSchema),
  routes: z.array(RouteEdgeSchema),
  metadata: z.object({
    facilityName: z.string().min(1),
    lastModified: z.string(),
    author: z.string(),
  }),
});

// ─── Failure Injection ────────────────────────────────────────────────────────

export type FailureSubsystem = 'sensor' | 'cv' | 'ble' | 'facility' | 'comms';
export type FailureMode =
  | 'stuck_high' | 'stuck_low' | 'noisy' | 'delayed' | 'missing'
  | 'false_positive' | 'false_negative'
  | 'unavailable' | 'timeout' | 'low_confidence' | 'forced_fallback'
  | 'beacon_loss' | 'partial_blackout' | 'reduced_precision' | 'frozen_positions'
  | 'sprinkler_fault' | 'ventilation_failure' | 'power_instability'
  | 'elevator_fault' | 'blocked_exit' | 'structural_degradation';

export const FailureSubsystemSchema = z.enum(['sensor', 'cv', 'ble', 'facility', 'comms']);
export const FailureModeSchema = z.enum([
  'stuck_high', 'stuck_low', 'noisy', 'delayed', 'missing',
  'false_positive', 'false_negative',
  'unavailable', 'timeout', 'low_confidence', 'forced_fallback',
  'beacon_loss', 'partial_blackout', 'reduced_precision', 'frozen_positions',
  'sprinkler_fault', 'ventilation_failure', 'power_instability',
  'elevator_fault', 'blocked_exit', 'structural_degradation',
]);

export interface FailureInjection {
  id: string;
  subsystem: FailureSubsystem;
  mode: FailureMode;
  targetZone?: Zone;
  severity: number;
  durationTicks?: number;
  startedAtTick: number;
  label?: string;
}

export const FailureInjectionSchema = z.object({
  subsystem: FailureSubsystemSchema,
  mode: FailureModeSchema,
  targetZone: ZoneSchema.optional(),
  severity: z.number().min(0).max(1),
  durationTicks: z.number().int().min(1).optional(),
  label: z.string().optional(),
});

export interface FailureState {
  activeFailures: FailureInjection[];
  totalInjected: number;
  totalCleared: number;
}

// ─── Prediction Explanation ───────────────────────────────────────────────────

export interface PredictionExplanation {
  predictionId: string;
  sourceZone: Zone;
  sourceIncident: IncidentType;
  targetZone: Zone;
  predictedIncident: IncidentType;
  dependencyType: DependencyType;
  dependencyWeight: number;
  confidenceBreakdown: {
    physicsContribution: number;
    historicalContribution: number;
    blendedConfidence: number;
  };
  etaReasoning: string;
  thresholdsCrossed: string[];
  triggerConditions: string[];
  narrativeSummary: string;
  generatedAt: number;
}

export interface PredictionV2 extends Prediction {
  explanation: PredictionExplanation;
}

// ─── Simulation Session ───────────────────────────────────────────────────────

export type SessionTimelineEventType =
  | 'incident_triggered' | 'incident_confirmed' | 'incident_resolved'
  | 'prediction_raised' | 'prediction_cleared'
  | 'failure_injected' | 'failure_cleared'
  | 'playbook_completed' | 'evacuation_started' | 'evacuation_completed'
  | 'ble_activated' | 'cv_result' | 'operator_action';

export interface SessionTimelineEvent {
  tick: number;
  timestamp: number;
  type: SessionTimelineEventType;
  zone?: Zone;
  detail: string;
  data?: Record<string, unknown>;
}

export interface SimulationSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  simulationMode: SimulationMode;
  tickCount: number;
  timeline: SessionTimelineEvent[];
  scenarioName?: string;
}

// ─── Evacuation ───────────────────────────────────────────────────────────────

export type EvacuationStatus = 'idle' | 'moving' | 'evacuated' | 'trapped' | 'assisting';

export interface EvacuationAgent {
  id: string;
  role: PersonRole;
  currentZone: Zone;
  x: number;
  y: number;
  targetExitId: string | null;
  status: EvacuationStatus;
  riskExposure: number;
  pathHistory: string[];
}

export interface EvacuationMetrics {
  totalOccupants: number;
  evacuatedCount: number;
  trappedCount: number;
  movingCount: number;
  avgEvacuationTimeTicks: number;
  responderArrivalTicks: number | null;
  highestRiskZone: Zone | null;
  reroutes: number;
  blockedExitImpacts: number;
}

// ─── Dynamic Evacuation Route ─────────────────────────────────────────────────

export interface EvacuationRouteRequest {
  personId?: string;
  startNodeId?: string;
  startX?: number;
  startY?: number;
  floor: FloorId;
  avoidDangerous?: boolean;
}

export interface EvacuationRouteResponse {
  path: string[];
  exitNodeId: string;
  pathCoordinates: { x: number; y: number; nodeId: string }[];
  totalCost: number;
  estimatedTimeSec: number;
  riskScore: number;
  blockedAlternatives: number;
  timestamp: number;
}

// ─── ICS Task Board ───────────────────────────────────────────────────────────

export type ICSTaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type ICSTaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ICSTaskCategory = 'search_rescue' | 'fire_suppression' | 'medical' | 'evacuation' | 'hazmat' | 'perimeter' | 'utility' | 'other';

export interface ICSTask {
  id: string;
  title: string;
  description: string;
  category: ICSTaskCategory;
  priority: ICSTaskPriority;
  status: ICSTaskStatus;
  assignedUnit: string | null;
  targetZone: Zone | null;
  targetFloor: FloorId | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  createdBy: string;
  auditLog: ICSAuditEntry[];
}

export interface ICSAuditEntry {
  timestamp: number;
  action: string;
  actor: string;
  details?: string;
}

export interface ICSTaskBoard {
  tasks: ICSTask[];
  activeCount: number;
  completedCount: number;
  lastUpdated: number;
}

// ─── Cellular Automata Grid ───────────────────────────────────────────────────

export interface CACell {
  temperature: number;
  smoke: number;
  gas: number;
  blocked: boolean;
}

export interface CAGridState {
  width: number;
  height: number;
  cells: CACell[][];
  tick: number;
}

// ─── After-Action Report ──────────────────────────────────────────────────────

export interface SimulationReport {
  id: string;
  sessionId: string;
  generatedAt: string;
  session: SimulationSession;
  incidentSummary: {
    incidentTypes: IncidentType[];
    affectedZones: Zone[];
    confirmedCount: number;
    escalatedToManualReview: number;
  };
  predictionSummary: {
    totalRaised: number;
    highestConfidence: number;
    resolvedCount: number;
    unresolvedCount: number;
    topCascades: string[];
  };
  failureSummary: {
    totalInjected: number;
    bySubsystem: Record<string, number>;
    activeAtEnd: number;
  };
  operatorSummary: {
    playbookStepsCompleted: number;
    playbookStepsTotal: number;
    timeToFirstMitigationTicks: number | null;
    unresolvedActions: number;
  };
  evacuationSummary?: EvacuationMetrics;
  timeline: SessionTimelineEvent[];
  outcomeAssessment: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
}

// ─── WebSocket Events (API → Frontend) ────────────────────────────────────────

export interface TickPayload {
  timestamp: number;
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
  activeFailures?: FailureInjection[];
  evacuationAgents?: EvacuationAgent[];
  evacuationMetrics?: EvacuationMetrics | null;
  evacuationActive?: boolean;
  graphState?: GraphState;
  crisisEvents?: CrisisEvent[];
  restrictedZone?: Zone;
  // ─── Multi-floor fields ─────────────────────────────────────────────────────────────
  activeFloor?: number;
  floorCount?: number;
  floorPhysics?: Record<number, Record<Zone, ZonePhysics>>;
  floorStates?: Record<number, Record<Zone, ZoneIncidentState>>;
}

export type TickPayloadDelta = Partial<TickPayload> & {
  timestamp: number;
  tick: number;
  zonePhysics?: Partial<Record<Zone, ZonePhysics>>;
  zoneStates?: Partial<Record<Zone, ZoneIncidentState>>;
  graphState?: GraphState;
  crisisEvents?: CrisisEvent[];
};

// ============================================================
// GRAPH-BASED SPATIAL SYSTEM
// ============================================================

/** Node types in the facility graph */
export type NodeType = 'hub' | 'corridor' | 'room' | 'hazard' | 'critical';

/** Micro-zone classification types */
export type ZoneType = 'core' | 'corridor' | 'public' | 'private' | 'hazard' | 'critical';

/** Entity movement/status states */
export type EntityStatus = 'idle' | 'moving' | 'evacuating' | 'trapped';

/** Risk classification levels */
export type RiskLevel = 'safe' | 'warning' | 'dangerous' | 'critical';

/** A node in the facility graph representing a physical location */
export interface GraphNode {
  id: string;
  zoneId: string;         // micro-zone ID (e.g., 'hub-center')
  parentZone: Zone;       // macro-zone ('A'|'B'|'C'|'D') for backward compat
  x: number;              // 0-100 normalized coordinate
  y: number;              // 0-100 normalized coordinate
  type: NodeType;
  isExit?: boolean;
  floor?: string | number;
}

/** A weighted edge connecting two graph nodes */
export interface GraphEdge {
  from: string;           // source node ID
  to: string;             // target node ID
  weight: number;         // traversal cost (distance-based)
  blocked: boolean;       // true if impassable due to crisis
}

/** A micro-zone grouping multiple graph nodes with shared sensor data */
export interface MicroZone {
  id: string;
  label: string;
  type: ZoneType;
  parentZone: Zone;       // maps to macro-zone for backward compat
  riskLevel: number;      // 0-100 (0-30 safe, 30-60 warning, 60-80 dangerous, 80-100 critical)
  sensorData: {
    temperature: number;
    smoke: number;
    gas: number;
    structural: number;
  };
  nodeIds: string[];      // IDs of nodes belonging to this micro-zone
}

/** An entity (person) tracked in the graph simulation */
export interface SimEntity {
  id: string;
  type: PersonRole;       // reuse existing 'guest' | 'staff' | 'responder'
  currentNode: string;    // current graph node ID
  targetNode?: string;    // destination node ID
  path: string[];         // ordered node IDs to traverse
  status: EntityStatus;
  riskExposure: number;   // cumulative risk exposure 0-1
}

/** Complete graph state snapshot for a single tick */
export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  zones: MicroZone[];
  entities: SimEntity[];
}

/** Crisis event types emitted by the graph simulation */
export type CrisisEventType =
  | 'FIRE_SPREAD'
  | 'GAS_SPREAD'
  | 'NODE_BLOCKED'
  | 'EDGE_BLOCKED'
  | 'ENTITY_MOVED'
  | 'ENTITY_EVACUATED'
  | 'RISK_UPDATED'
  | 'PATH_RECALCULATED'
  | 'ENTRY_SECURITY_ALERT'
  | 'THREAT_ALERT';

export interface ThreatAlertPayload {
  threatType: string;
  severity: RiskLevel;
  sourceNodeId: string;
}

/** A crisis event emitted during graph simulation */
export interface CrisisEvent {
  type: CrisisEventType;
  tick: number;
  nodeId?: string;
  edgeFrom?: string;
  edgeTo?: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

/** Utility: classify a numeric risk level into a named category */
export function classifyRisk(level: number): RiskLevel {
  if (level >= 80) return 'critical';
  if (level >= 60) return 'dangerous';
  if (level >= 30) return 'warning';
  return 'safe';
}
