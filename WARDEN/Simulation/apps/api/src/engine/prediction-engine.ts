// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Predictive Cascade Engine (v1.2)
// Simulates future environment states to predict cascading failures.
// Runs every 15 real-world seconds via an interval timer.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Zone, IncidentType, Prediction, PredictionV2, PredictionExplanation, DependencyLink, DependencyType, ZonePhysics } from '../types';
import { EnvironmentEngine } from './environment';

import type { ConfigService } from '../services/config-service';

// ─── Confidence thresholds ────────────────────────────────────────────────────
const MIN_CONFIDENCE = 0.40;          // 40% minimum to broadcast
const LOOKAHEAD_TICKS = 300;          // 5 minutes (300 × 1s ticks)
const HISTORY_WEIGHT = 0.30;          // 30% from VDB history
const PHYSICS_WEIGHT = 0.70;          // 70% from real-time projection
const SIGNIFICANT_CHANGE_THRESHOLD = 0.05; // 5% change triggers lookahead recalculation

// ─── Sensor anomaly thresholds (mirrors SensorGrid logic) ─────────────────────
const THRESHOLDS: Record<string, { key: keyof ZonePhysics; threshold: number; incident: IncidentType }[]> = {
  fire: [
    { key: 'temperature', threshold: 55, incident: 'fire' },
    { key: 'fireIntensity', threshold: 0.3, incident: 'fire' },
  ],
  gas: [
    { key: 'gasLevel', threshold: 80, incident: 'gas_leak' },
  ],
  collapse: [
    { key: 'vibration', threshold: 1.5, incident: 'structural_collapse' },
    { key: 'structuralIntegrity', threshold: 0.5, incident: 'structural_collapse' }, // BELOW this
  ],
  explosion: [
    { key: 'temperature', threshold: 90, incident: 'explosion' },
    { key: 'vibration', threshold: 3.0, incident: 'explosion' },
  ],
};

// ─── Default facility dependency matrix (fallback if no config) ───────────────
const DEFAULT_DEPENDENCY_GRAPH: DependencyLink[] = [
  // Gas Main: A ↔ C
  { sourceZone: 'A', targetZone: 'C', linkType: 'gas', weight: 0.75 },
  { sourceZone: 'C', targetZone: 'A', linkType: 'gas', weight: 0.75 },
  // Structural Load Path: B ↔ D
  { sourceZone: 'B', targetZone: 'D', linkType: 'structural', weight: 0.80 },
  { sourceZone: 'D', targetZone: 'B', linkType: 'structural', weight: 0.80 },
  // Primary Electric Grid: A ↔ B
  { sourceZone: 'A', targetZone: 'B', linkType: 'electric', weight: 0.60 },
  { sourceZone: 'B', targetZone: 'A', linkType: 'electric', weight: 0.60 },
];

// ─── Incident-to-dependency propagation map ───────────────────────────────────
const CASCADE_RULES: Record<IncidentType, { via: DependencyType; produces: IncidentType; reasoning: string }[]> = {
  fire: [
    { via: 'gas', produces: 'explosion', reasoning: 'Fire heat propagating through shared gas main' },
    { via: 'electric', produces: 'fire', reasoning: 'Electrical fault from fire damage cascading via power grid' },
    { via: 'structural', produces: 'structural_collapse', reasoning: 'Prolonged fire weakening shared structural supports' },
  ],
  explosion: [
    { via: 'structural', produces: 'structural_collapse', reasoning: 'Blast shockwave transmitted through shared load-bearing structure' },
    { via: 'gas', produces: 'gas_leak', reasoning: 'Explosion rupturing shared gas supply line' },
    { via: 'electric', produces: 'fire', reasoning: 'Explosion causing electrical short in connected grid' },
  ],
  gas_leak: [
    { via: 'gas', produces: 'explosion', reasoning: 'Gas accumulation reaching ignition threshold in connected zone' },
    { via: 'gas', produces: 'gas_leak', reasoning: 'Gas leak migrating through shared gas main' },
  ],
  structural_collapse: [
    { via: 'structural', produces: 'structural_collapse', reasoning: 'Load redistribution causing stress failure in connected zone' },
    { via: 'electric', produces: 'fire', reasoning: 'Collapse severing electrical conduits, causing sparks' },
  ],
  medical_emergency: [],
  security_breach: [
    { via: 'electric', produces: 'power_outage', reasoning: 'Security breach leading to infrastructure sabotage' },
  ],
  active_shooter: [
    { via: 'structural', produces: 'security_breach', reasoning: 'Active intruder compromising structural security barriers' },
  ],
  power_outage: [
    { via: 'electric', produces: 'power_outage', reasoning: 'Grid instability propagating to adjacent sectors' },
  ],
};

// ─── Prediction ID counter ────────────────────────────────────────────────────
let predictionIdCounter = 0;
function nextPredictionId() { return `PRED-${String(++predictionIdCounter).padStart(4, '0')}`; }

// ═══════════════════════════════════════════════════════════════════════════════

export class PredictionEngine {
  private predictions: PredictionV2[] = [];
  private dependencyCache: DependencyLink[] = [];
  private mitigatedZones = new Set<string>(); // "zone:incidentType" keys cleared instantly
  private lastPhysicsSnapshot: Record<Zone, ZonePhysics> | null = null;
  private cachedProjections: Map<string, { tick: number; physics: ZonePhysics }> = new Map();
  private lastHistoricalBias: Map<string, number> = new Map();
  private isRunningState = false;
  private environmentRef: EnvironmentEngine;
  private configServiceRef: ConfigService | null;

  constructor(env: EnvironmentEngine, configService?: ConfigService) {
    this.environmentRef = env;
    this.configServiceRef = configService ?? null;
    this.refreshDependencies();
  }

  /** Reload dependency links from config (called after config edits) */
  refreshDependencies() {
    if (this.configServiceRef) {
      try {
        this.dependencyCache = this.configServiceRef.getDependencyLinks();
        console.log(`[PREDICT] 🔗 Loaded ${this.dependencyCache.length} dependency links from config`);
        return;
      } catch (err: unknown) {
        console.warn(`[PREDICT] ⚠️ Config load failed, using defaults: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.dependencyCache = [...DEFAULT_DEPENDENCY_GRAPH];
  }

  getDependencyLinks(): DependencyLink[] {
    return [...this.dependencyCache];
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  start() {
    this.isRunningState = true;
    this.predictions = [];
    this.mitigatedZones.clear();
    this.lastPhysicsSnapshot = null;
    this.cachedProjections.clear();
    console.log('[PREDICT] 🧠 Prediction Engine active (per-tick analysis, 300s lookahead)');
  }

  stop() {
    this.isRunningState = false;
    this.predictions = [];
    this.mitigatedZones.clear();
    console.log('[PREDICT] Prediction Engine standby');
  }

  reset() {
    this.stop();
    predictionIdCounter = 0;
    this.lastPhysicsSnapshot = null;
    this.cachedProjections.clear();
  }

  getPredictions(): PredictionV2[] {
    return [...this.predictions];
  }

  /** Return all current prediction explanations */
  getExplanations(): PredictionExplanation[] {
    return this.predictions.map(p => p.explanation);
  }

  /** Return a single explanation by prediction ID */
  getExplanation(predictionId: string): PredictionExplanation | null {
    const pred = this.predictions.find(p => p.id === predictionId);
    return pred?.explanation ?? null;
  }

  /** Called when a mitigation/playbook action removes the threat — instantly clears matching predictions */
  mitigate(zone: Zone, incidentType: IncidentType) {
    const key = `${zone}:${incidentType}`;
    this.mitigatedZones.add(key);
    // Immediately purge matching predictions
    this.predictions = this.predictions.filter(p => `${p.zone}:${p.incidentType}` !== key);
    console.log(`[PREDICT] ✅ Mitigation applied: ${incidentType} in Zone ${zone} — ghost markers cleared`);
  }

  /** Called when an incident is resolved — clears related predictions */
  clearZone(zone: Zone) {
    // Clear predictions where this zone was the source
    this.predictions = this.predictions.filter(p => p.sourceZone !== zone);
    // Also clear mitigations for this zone
    for (const key of this.mitigatedZones) {
      if (key.startsWith(`${zone}:`)) this.mitigatedZones.delete(key);
    }
  }

  /** Called every tick by the simulation loop */
  async tick(allPhysics: Record<Zone, ZonePhysics>) {
    if (!this.isRunningState) return;

    try {
      const zones = this.environmentRef.getZones();

      // Step 1: Check for significant change to trigger heavy lookahead
      const physicsChanged = this.checkSignificantChange(allPhysics);

      // Step 2: Identify currently active incidents (from real physics)
      const activeIncidents = this.detectActiveIncidents(allPhysics);

      if (activeIncidents.length === 0) {
        this.predictions = [];
        this.lastPhysicsSnapshot = { ...allPhysics };
        return;
      }

      // Step 3: Run sandboxed lookahead simulation (only if significant change)
      if (physicsChanged || this.cachedProjections.size === 0) {
        const snapshot = this.environmentRef.serializeState();
        this.cachedProjections = this.projectPhysics(snapshot, zones);
        // Also refresh historical bias when physics change significantly
        this.lastHistoricalBias = await this.queryHistoricalPatterns(activeIncidents);
      }

      // Step 4: Calculate blended predictions (every tick, using latest physics + cached projection)
      const rawPredictions = this.blendPredictions(
        activeIncidents,
        this.cachedProjections,
        this.lastHistoricalBias
      );

      // Step 5: Filter by minimum confidence and remove mitigated predictions
      this.predictions = rawPredictions
        .filter(p => p.confidence >= MIN_CONFIDENCE)
        .filter(p => !this.mitigatedZones.has(`${p.zone}:${p.incidentType}`));

      this.lastPhysicsSnapshot = JSON.parse(JSON.stringify(allPhysics));
    } catch (err: unknown) {
      console.error('[PREDICT] Tick error:', err instanceof Error ? err.message : String(err));
    }
  }

  private checkSignificantChange(current: Record<Zone, ZonePhysics>): boolean {
    if (!this.lastPhysicsSnapshot) return true;

    for (const zone of this.environmentRef.getZones()) {
      const last = this.lastPhysicsSnapshot[zone];
      const now = current[zone];

      // Check key incident triggers
      if (Math.abs(now.temperature - last.temperature) > 5) return true;
      if (Math.abs(now.fireIntensity - last.fireIntensity) > 0.1) return true;
      if (Math.abs(now.gasLevel - last.gasLevel) > 10) return true;
      if (Math.abs(now.vibration - last.vibration) > 0.5) return true;
      if (Math.abs(now.structuralIntegrity - last.structuralIntegrity) > 0.05) return true;
    }

    return false;
  }

  // ── Detect active incidents from physics ────────────────────────────────────
  private detectActiveIncidents(physics: Record<Zone, ZonePhysics>): { zone: Zone; type: IncidentType }[] {
    const active: { zone: Zone; type: IncidentType }[] = [];
    const zones = this.environmentRef.getZones();

    for (const zone of zones) {
      const p = physics[zone];
      if (p.fireIntensity > 0.2 || p.temperature > 55) {
        active.push({ zone, type: 'fire' });
      }
      if (p.gasLevel > 80) {
        active.push({ zone, type: 'gas_leak' });
      }
      if (p.vibration > 1.5 || p.structuralIntegrity < 0.5) {
        active.push({ zone, type: 'structural_collapse' });
      }
      if (p.temperature > 90 && p.vibration > 3.0) {
        active.push({ zone, type: 'explosion' });
      }
    }
    return active;
  }

  // ── Sandboxed lookahead simulation ──────────────────────────────────────────
  private projectPhysics(
    snapshot: ReturnType<EnvironmentEngine['serializeState']>,
    zones: Zone[]
  ): Map<string, { tick: number; physics: ZonePhysics }> {
    const sandbox = EnvironmentEngine.fromSnapshot(snapshot);
    const projections = new Map<string, { tick: number; physics: ZonePhysics }>();

    // Simulate 300 ticks into the future (5 minutes)
    for (let t = 1; t <= LOOKAHEAD_TICKS; t++) {
      sandbox.tick();

      // Check every zone for newly emerged anomalies
      for (const zone of zones) {
        const p = sandbox.getPhysics(zone);
        const checks: { incident: IncidentType; triggered: boolean }[] = [
          { incident: 'fire', triggered: p.fireIntensity > 0.3 || p.temperature > 55 },
          { incident: 'gas_leak', triggered: p.gasLevel > 80 },
          { incident: 'structural_collapse', triggered: p.vibration > 1.5 || p.structuralIntegrity < 0.5 },
          { incident: 'explosion', triggered: p.temperature > 90 && p.vibration > 3.0 },
        ];

        for (const check of checks) {
          const key = `${zone}:${check.incident}`;
          if (check.triggered && !projections.has(key)) {
            projections.set(key, { tick: t, physics: p });
          }
        }
      }
    }
    return projections;
  }

  // ── VDB historical pattern correlation ──────────────────────────────────────
  private async queryHistoricalPatterns(
    activeIncidents: { zone: Zone; type: IncidentType }[]
  ): Promise<Map<string, number>> {
    // VectorDB was removed. Returning empty historical biases.
    return new Map<string, number>();
  }

  // ── Blend physics + history into final predictions ──────────────────────────
  private blendPredictions(
    activeIncidents: { zone: Zone; type: IncidentType }[],
    physicsProjections: Map<string, { tick: number; physics: ZonePhysics }>,
    historicalBias: Map<string, number>
  ): PredictionV2[] {
    const predictions: PredictionV2[] = [];
    const seen = new Set<string>(); // Deduplicate

    for (const incident of activeIncidents) {
      const rules = CASCADE_RULES[incident.type] ?? [];

      for (const rule of rules) {
        // Find matching dependency links
        const links = this.dependencyCache.filter(
          l => l.sourceZone === incident.zone && l.linkType === rule.via
        );

        for (const link of links) {
          const predictionKey = `${link.targetZone}:${rule.produces}`;
          if (seen.has(predictionKey)) continue;
          seen.add(predictionKey);

          // Physics projection confidence
          const projKey = `${link.targetZone}:${rule.produces}`;
          const projection = physicsProjections.get(projKey);
          const physicsConfidence = projection
            ? Math.min(1, link.weight * (1 - (projection.tick / LOOKAHEAD_TICKS)))
            : link.weight * 0.3; // Base structural confidence even without projection trigger

          // Historical bias
          const histKey = `${link.targetZone}:from:${incident.zone}`;
          const historyConfidence = historicalBias.get(histKey) ?? 0;

          // Blended confidence
          const blended = (PHYSICS_WEIGHT * physicsConfidence) + (HISTORY_WEIGHT * historyConfidence);

          // ETA: from projection if available, else estimate from dependency weight
          const eta = projection
            ? projection.tick
            : Math.round(LOOKAHEAD_TICKS * (1 - link.weight));

          // Build threshold details
          const thresholdsCrossed: string[] = [];
          const triggerConditions: string[] = [];

          if (projection) {
            const pp = projection.physics;
            if (pp.fireIntensity > 0.3) thresholdsCrossed.push(`Fire intensity ${(pp.fireIntensity * 100).toFixed(0)}% > 30% threshold`);
            if (pp.temperature > 55) thresholdsCrossed.push(`Temperature ${pp.temperature.toFixed(1)}°C > 55°C threshold`);
            if (pp.gasLevel > 80) thresholdsCrossed.push(`Gas level ${pp.gasLevel.toFixed(0)} PPM > 80 PPM threshold`);
            if (pp.vibration > 1.5) thresholdsCrossed.push(`Vibration ${pp.vibration.toFixed(2)}g > 1.5g threshold`);
            if (pp.structuralIntegrity < 0.5) thresholdsCrossed.push(`Structural integrity ${(pp.structuralIntegrity * 100).toFixed(0)}% < 50% threshold`);
          }

          triggerConditions.push(`Active ${incident.type.replace('_', ' ')} in Zone ${incident.zone}`);
          triggerConditions.push(`${link.linkType} dependency (weight ${link.weight.toFixed(2)}) from ${link.sourceZone} → ${link.targetZone}`);
          if (projection) triggerConditions.push(`Physics simulation crossed thresholds at tick ${projection.tick}`);
          if (historyConfidence > 0) triggerConditions.push(`Historical pattern match: ${(historyConfidence * 100).toFixed(0)}% correlation`);

          // Build ETA reasoning
          const etaReasoning = projection
            ? `Physics simulation predicts threshold breach at tick ${projection.tick} (~${eta}s from now)`
            : `Estimated from dependency weight: ${(1 - link.weight).toFixed(2)} × ${LOOKAHEAD_TICKS} ticks = ~${eta}s`;

          // Build narrative
          const confidencePct = (Math.min(1, blended) * 100).toFixed(0);
          const narrativeSummary = [
            `${rule.produces.replace('_', ' ').toUpperCase()} risk detected in Zone ${link.targetZone}.`,
            `Caused by active ${incident.type.replace('_', ' ')} in Zone ${incident.zone},`,
            `propagating via ${link.linkType} infrastructure link (weight ${link.weight.toFixed(2)}).`,
            `Combined confidence: ${confidencePct}%`,
            `(physics: ${(physicsConfidence * 100).toFixed(0)}%,`,
            `historical: ${(historyConfidence * 100).toFixed(0)}%).`,
            projection
              ? `Lookahead simulation shows threshold breach at tick ${projection.tick}.`
              : 'No physical threshold breach observed in lookahead — estimate based on structural coupling.',
          ].join(' ');

          const predId = nextPredictionId();

          const explanation: PredictionExplanation = {
            predictionId: predId,
            sourceZone: incident.zone,
            sourceIncident: incident.type,
            targetZone: link.targetZone,
            predictedIncident: rule.produces,
            dependencyType: link.linkType,
            dependencyWeight: link.weight,
            confidenceBreakdown: {
              physicsContribution: PHYSICS_WEIGHT * physicsConfidence,
              historicalContribution: HISTORY_WEIGHT * historyConfidence,
              blendedConfidence: Math.min(1, blended),
            },
            etaReasoning,
            thresholdsCrossed,
            triggerConditions,
            narrativeSummary,
            generatedAt: Date.now(),
          };

          predictions.push({
            id: predId,
            zone: link.targetZone,
            incidentType: rule.produces,
            confidence: Math.min(1, blended),
            eta,
            reasoning: `${rule.reasoning} (${link.sourceZone}→${link.targetZone} via ${link.linkType})`,
            sourceZone: incident.zone,
            sourceIncident: incident.type,
            linkType: link.linkType,
            explanation,
          });
        }
      }
    }

    // Sort by confidence descending
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }
}
