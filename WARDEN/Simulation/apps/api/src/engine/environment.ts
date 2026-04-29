// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Environment Physics Engine
// Interconnected sensor physics with dissipation curves
// ═══════════════════════════════════════════════════════════════════════════════

import type { Zone, ZonePhysics, IncidentType } from '../types';
import type { GraphData } from '../map/graph';
import { DEFAULT_PHYSICS } from '../types';
import { rnd, gaussian, lerp, saturate } from './math-utils';

// ─── Hard Limits ──────────────────────────────────────────────────────────────
const MAX_TEMP = 120;
const MAX_SMOKE = 100;
const MAX_GAS = 500;
const MAX_VIB = 10;

// ─── Fire Source ──────────────────────────────────────────────────────────────
interface FireSource {
  intensity: number;
  active: boolean;
  growthRate: number;
  decayRate: number;
}

// ─── Collapse Source ──────────────────────────────────────────────────────────
interface CollapseSource {
  severity: number; // 0–1
  active: boolean;
  growthRate: number;
  decayRate: number;
}

// ─── Hardcoded Adjacency Fallback ──────────────────────────────────────────────
const FALLBACK_ADJACENCY: Record<Zone, Zone[]> = {
  A: ['B', 'C'],
  B: ['A', 'D'],
  C: ['A', 'D'],
  D: ['B', 'C'],
};

const BASE_PROPAGATION_FACTOR = 0.15;

export class EnvironmentEngine {
  private physics = new Map<string, ZonePhysics>();
  private baselines = new Map<string, ZonePhysics>();
  private fireSources = new Map<string, FireSource>();
  private collapseSources = new Map<string, CollapseSource>();
  private sprinklerFaults = new Map<string, boolean>();
  private graphData?: GraphData;
  private adjacency: Record<string, { zone: string; weight: number }[]> = {};
  private restrictedZone: string | null = null;
  private floorId: number;

  /** Vertical coupling: allows heat/smoke to rise from floor below */
  private verticalInput: Partial<ZonePhysics> = {};

  /** Restrict all physics activity to a single zone (null = unrestricted) */
  setRestrictedZone(zone: string | null) { this.restrictedZone = zone; }
  getRestrictedZone(): string | null { return this.restrictedZone; }

  /** Return all active zones (graph node IDs or legacy A-D) */
  getZones(): string[] { return Array.from(this.physics.keys()); }

  /** Get floor ID for this engine instance */
  getFloorId(): number { return this.floorId; }

  constructor(floorId: number, graphData?: GraphData) {
    this.floorId = floorId;
    this.graphData = graphData;
    this.initZones();
  }

  private initZones() {
    if (this.graphData) {
      // Dynamically discover all zones from the graph nodes
      for (const node of this.graphData.nodes.values()) {
        const z = node.parentZone;
        if (!this.physics.has(z)) {
          this.physics.set(z, { ...DEFAULT_PHYSICS });
          this.baselines.set(z, { ...DEFAULT_PHYSICS });
          this.sprinklerFaults.set(z, false);
          this.adjacency[z] = [];
        }
      }
    } else {
      // Fallback for legacy support
      const zones = ['A', 'B', 'C', 'D'];
      for (const z of zones) {
        this.physics.set(z, { ...DEFAULT_PHYSICS });
        this.baselines.set(z, { ...DEFAULT_PHYSICS });
        this.sprinklerFaults.set(z, false);
        this.adjacency[z] = [];
      }
    }
    this.buildAdjacency();
  }

  private buildAdjacency() {
    if (this.graphData) {
      const edgesBetweenZones = new Map<string, number[]>();
      for (const [nodeId, edges] of this.graphData.edges.entries()) {
        const node = this.graphData.nodes.get(nodeId);
        if (!node) continue;
        const srcZone = node.parentZone as Zone;
        for (const edge of edges) {
          const targetNode = this.graphData.nodes.get(edge.to);
          if (targetNode && targetNode.parentZone !== srcZone) {
            const dstZone = targetNode.parentZone as Zone;
            const key = `${srcZone}-${dstZone}`;
            const list = edgesBetweenZones.get(key) ?? [];
            list.push(edge.weight);
            edgesBetweenZones.set(key, list);
          }
        }
      }
      for (const [key, weights] of edgesBetweenZones.entries()) {
        const [srcZone, dstZone] = key.split('-') as [Zone, Zone];
        const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
        this.adjacency[srcZone].push({ zone: dstZone, weight: avgWeight });
      }
    } else {
      for (const z of this.physics.keys()) {
        const fallback = FALLBACK_ADJACENCY[z as keyof typeof FALLBACK_ADJACENCY];
        if (fallback) {
          this.adjacency[z] = fallback.map(dst => ({ zone: dst, weight: 1.0 }));
        }
      }
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────
  reset() {
    this.fireSources.clear();
    this.collapseSources.clear();
    this.sprinklerFaults.clear();
    
    // Only reset zones that actually exist in this engine's configuration
    for (const z of this.physics.keys()) {
      this.physics.set(z, { ...DEFAULT_PHYSICS });
      this.baselines.set(z, { ...DEFAULT_PHYSICS });
      this.sprinklerFaults.set(z, false);
    }
    
    this.restrictedZone = null;
    console.log(`[ENV] Reset floor ${this.floorId} environment`);
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  getPhysics(zone: string): ZonePhysics { return { ...this.physics.get(zone)! }; }
  getAllPhysics(): Record<string, ZonePhysics> {
    const out: Record<string, ZonePhysics> = {};
    for (const [z, p] of this.physics) out[z] = { ...p };
    return out;
  }

  getPhysicsForMicroZone(zoneId: string): ZonePhysics | null {
    if (!this.graphData) return null;
    const zone = this.graphData.zones.get(zoneId);
    if (!zone) return null;
    return this.physics.get(zone.parentZone as Zone) ?? null;
  }

  // ── State Serialization (for Prediction Engine lookahead) ───────────────────
  serializeState(): {
    physics: Record<string, ZonePhysics>;
    fireSources: Record<string, FireSource>;
    collapseSources: Record<string, CollapseSource>;
    sprinklerFaults: Record<string, boolean>;
  } {
    const physics: Record<string, ZonePhysics> = {};
    for (const [z, p] of this.physics) physics[z] = { ...p };
    const fireSources: Record<string, FireSource> = {};
    for (const [z, f] of this.fireSources) fireSources[z] = { ...f };
    const collapseSources: Record<string, CollapseSource> = {};
    for (const [z, c] of this.collapseSources) collapseSources[z] = { ...c };
    const sprinklerFaults: Record<string, boolean> = {};
    for (const [z, v] of this.sprinklerFaults) sprinklerFaults[z] = v;
    return { physics, fireSources, collapseSources, sprinklerFaults };
  }

  deserializeState(state: ReturnType<EnvironmentEngine['serializeState']>) {
    this.physics.clear();
    this.fireSources.clear();
    this.collapseSources.clear();
    this.sprinklerFaults.clear();
    for (const [z, p] of Object.entries(state.physics)) this.physics.set(z, { ...p });
    for (const [z, f] of Object.entries(state.fireSources)) this.fireSources.set(z, { ...f });
    for (const [z, c] of Object.entries(state.collapseSources)) this.collapseSources.set(z, { ...c });
    for (const [z, v] of Object.entries(state.sprinklerFaults)) this.sprinklerFaults.set(z, v);
    // Restore baselines from physics (clone uses same baseline)
    for (const [z, p] of this.physics) this.baselines.set(z, { ...DEFAULT_PHYSICS });
  }

  static fromSnapshot(state: ReturnType<EnvironmentEngine['serializeState']>, graphData?: GraphData): EnvironmentEngine {
    const clone = new EnvironmentEngine(-1, graphData);
    clone.deserializeState(state);
    return clone;
  }

  injectIncident(zone: string, type: IncidentType) {
    switch (type) {
      case 'fire': this.startFire(zone); break;
      case 'explosion': this.startExplosion(zone); break;
      case 'gas_leak': this.startGasLeak(zone); break;
      case 'structural_collapse': this.startCollapse(zone); break;
    }
  }

  startFire(zone: string) {
    // Boost initial intensity to 0.4 so it's immediately visible
    this.fireSources.set(zone, { intensity: 0.4, active: true, growthRate: rnd(0.01, 0.03), decayRate: 0.005 });
    const p = this.physics.get(zone);
    if (p) {
      p.fireIntensity = 0.4;
      p.temperature = Math.max(p.temperature, 45); // High enough to trigger immediate pulse
      p.smokeDensity = Math.max(p.smokeDensity, 20);
    }
  }

  startExplosion(zone: string) {
    const p = this.physics.get(zone);
    if (p) {
      p.temperature = Math.min(MAX_TEMP, p.temperature + 40);
      p.vibration = MAX_VIB;
      p.smokeDensity = Math.min(MAX_SMOKE, p.smokeDensity + 30);
      p.structuralIntegrity = Math.max(0, p.structuralIntegrity - 0.4);
    }
  }

  startGasLeak(zone: string) {
    const p = this.physics.get(zone);
    if (p) {
      p.gasLevel = 300; // High enough to trigger immediate pulse
    }
  }

  startCollapse(zone: string) {
    // Boost initial severity to 0.5
    this.collapseSources.set(zone, { severity: 0.5, active: true, growthRate: 0.02, decayRate: 0.01 });
    const p = this.physics.get(zone);
    if (p) {
      p.structuralIntegrity = 0.5;
      p.vibration = 5; // High enough to trigger immediate pulse
    }
  }

  /** Receive vertical physics leakage from floor below */
  injectVerticalEnergy(zone: string, energy: Partial<ZonePhysics>) {
    const p = this.physics.get(zone);
    if (!p) return;

    if (energy.temperature) p.temperature = Math.min(MAX_TEMP, p.temperature + energy.temperature);
    if (energy.smokeDensity) p.smokeDensity = Math.min(MAX_SMOKE, p.smokeDensity + energy.smokeDensity);
    if (energy.gasLevel) p.gasLevel = Math.min(MAX_GAS, p.gasLevel + energy.gasLevel);
  }

  // ── Tick ────────────────────────────────────────────────────────────────────
  tick(): Record<string, Partial<ZonePhysics>> {
    const verticalLeakage: Record<string, Partial<ZonePhysics>> = {};

    for (const [z] of this.physics) {
      // When restricted, strictly enforce baseline for dormant zones
      if (this.restrictedZone && z !== this.restrictedZone) {
        this.resetZoneToBaseline(z);
        continue;
      }

      this.updateNewSensors(z);
      this.updateSprinklers(z);  // Auto-deploy
      this.updateFire(z);
      this.updateCollapse(z);
      this.applyInterconnectedPhysics(z);
      this.applyAmbientNoise(z);
      this.decayToBaseline(z);

      // Calculate vertical leakage (smoke rises, heat spreads up)
      const p = this.physics.get(z)!;
      if (p.smokeDensity > 30 || p.temperature > 50) {
        verticalLeakage[z] = {
          smokeDensity: p.smokeDensity * 0.05,
          temperature: (p.temperature - 22) * 0.03,
          gasLevel: p.gasLevel * 0.02
        };
      }
    }

    // Disable cross-zone propagation in restricted mode
    if (!this.restrictedZone) {
      this.propagateToNeighbours();
    }

    return verticalLeakage;
  }

  private resetZoneToBaseline(z: string) {
    const p = this.physics.get(z)!;
    p.temperature = 22;
    p.smokeDensity = 0;
    p.gasLevel = 5;
    p.fireIntensity = 0;
    p.vibration = 0.02;
    p.structuralIntegrity = 1.0;
    p.heatRisk = 0;
    p.stress = 0;
  }

  // ── New Sensors Update ──────────────────────────────────────────────────────
  private updateNewSensors(zone: Zone) {
    const p = this.physics.get(zone)!;
    const fire = this.fireSources.get(zone);
    const collapse = this.collapseSources.get(zone);

    // Water leak: sprinkler active or fire → leak risk
    if (p.sprinklerStatus === 'active' || (fire && fire.intensity > 0.3)) {
      p.waterLeak = Math.min(100, p.waterLeak + rnd(0.5, 2));
    }

    // Energy meter: surge on explosion/fire, drop on backup
    if (collapse && collapse.severity > 0.5) {
      p.energyUsage = Math.min(20, p.energyUsage * 0.7); // Power cut
    } else if (p.vibration > 1.5 || (fire && fire.intensity > 0.6)) {
      p.energyUsage = Math.min(150, p.energyUsage + rnd(10, 30)); // Surge
      if (p.energyUsage > 120) {
        p.energyUsage = 30; // Auto-shutdown → backup
      }
    }

    // Elevator: Dynamic degradation as situation becomes more critical
    p.elevatorOccupancy = Math.max(0, Math.min(1, p.elevatorOccupancy + gaussian(0.01))); // Natural variance
    
    // Calculate a consolidated hazard criticality score (0.0 - 1.0+)
    const criticality =
      (p.temperature / 120) * 0.3 +
      (p.smokeDensity / 100) * 0.2 +
      (p.fireIntensity) * 0.3 +
      (p.vibration / 10) * 0.2 +
      (1 - p.structuralIntegrity) * 0.1;

    if (p.elevatorStatus !== 'faulty') {
      if (criticality > 0.7 || p.waterLeak > 80 || (collapse && collapse.severity > 0.8)) {
        p.elevatorStatus = 'faulty';
      } else if (criticality > 0.4 || p.waterLeak > 50 || (collapse && collapse.severity > 0.4)) {
        p.elevatorStatus = 'jammed';
      } else if (criticality > 0.15 || p.waterLeak > 20 || (collapse && collapse.severity > 0.15)) {
        // Degrade to warning if not already jammed/faulty
        if (p.elevatorStatus === 'normal') {
          p.elevatorStatus = 'warning';
        }
      }
    }
  }

  // ── FIRE physics ────────────────────────────────────────────────────────────
  private updateFire(zone: Zone) {
    const src = this.fireSources.get(zone);
    if (!src) return;
    const p = this.physics.get(zone)!;

    if (src.active) {
      src.intensity = Math.min(1, src.intensity + src.growthRate * rnd(0.8, 1.2));
    } else {
      src.intensity = Math.max(0, src.intensity - src.decayRate * rnd(0.8, 1.2));
      if (src.intensity <= 0.001) { this.fireSources.delete(zone); return; }
    }

    const i = src.intensity;

    // ─── INTERCONNECTED PHYSICS: Fire → Temperature + Smoke + Gas ─────────
    p.temperature = saturate(p.temperature, rnd(3, 8) * i, MAX_TEMP);
    p.smokeDensity = saturate(p.smokeDensity, rnd(2, 6) * i, MAX_SMOKE);
    p.gasLevel = saturate(p.gasLevel, rnd(3, 10) * i, MAX_GAS);
    p.fireIntensity = i;

    // Stochastic flare-up removed to eradicate random events
  }

  // ── COLLAPSE physics ────────────────────────────────────────────────────────
  private updateCollapse(zone: Zone) {
    const src = this.collapseSources.get(zone);
    if (!src) return;
    const p = this.physics.get(zone)!;

    if (src.active) {
      src.severity = Math.min(1, src.severity + src.growthRate * rnd(0.8, 1.2));
    } else {
      src.severity = Math.max(0, src.severity - src.decayRate * rnd(0.8, 1.2));
      if (src.severity <= 0.001) { this.collapseSources.delete(zone); return; }
    }

    const s = src.severity;

    // ─── INTERCONNECTED: Collapse → Vibration + Structural Integrity + Dust(Smoke) ──
    p.vibration = saturate(p.vibration, rnd(0.5, 2) * s, MAX_VIB);
    p.structuralIntegrity = Math.max(0, p.structuralIntegrity - rnd(0.01, 0.04) * s);
    p.smokeDensity = saturate(p.smokeDensity, rnd(1, 4) * s, MAX_SMOKE); // dust
  }

  // ── Interconnected cross-effects ──────────────────────────────────────────
  private applyInterconnectedPhysics(zone: string) {
    const p = this.physics.get(zone)!;

    // High temperature with no active fire → smoldering residual smoke
    if (p.temperature > 60 && !this.fireSources.has(zone)) {
      p.smokeDensity = saturate(p.smokeDensity, rnd(0.1, 0.5), MAX_SMOKE);
    }

    // Fire damages structural integrity over time
    const fire = this.fireSources.get(zone);
    if (fire && fire.intensity > 0.5) {
      p.structuralIntegrity = Math.max(0.1, p.structuralIntegrity - rnd(0.002, 0.008));
    }

    // Low structural integrity causes vibration spikes
    if (p.structuralIntegrity < 0.5) {
      p.vibration = saturate(p.vibration, rnd(0.05, 0.2) * (1 - p.structuralIntegrity), MAX_VIB);
    }
  }

  // ── Ambient noise ─────────────────────────────────────────────────────────
  private applyAmbientNoise(zone: string) {
    // Ambient noise removed to eradicate random events
  }

  // ── Dissipation / Decay back to baseline ──────────────────────────────────
  private updateSprinklers(zone: string) {
    const p = this.physics.get(zone)!;
    const faulted = this.sprinklerFaults.get(zone)!;

    if (faulted) {
      p.sprinklerStatus = 'faulty';
      return; // Faulted = no auto-deploy
    }

    const needsActivation = p.temperature > 65 || p.smokeDensity > 25;
    const safeToDeactivate = p.temperature < 40 && p.smokeDensity < 5;

    if (needsActivation && p.sprinklerStatus !== 'active') {
      p.sprinklerStatus = 'active';
    } else if (safeToDeactivate && p.sprinklerStatus === 'active') {
      p.sprinklerStatus = 'idle';
    }
  }

  private decayToBaseline(zone: string) {
    const p = this.physics.get(zone)!;
    const b = this.baselines.get(zone)!;

    // DISSIPATION CURVES — values ease back towards baseline, never snap
    if (!this.fireSources.has(zone)) {
      p.temperature = lerp(p.temperature, b.temperature, rnd(0.01, 0.04));
      p.fireIntensity = lerp(p.fireIntensity, 0, rnd(0.03, 0.08));
    }
    p.smokeDensity = lerp(p.smokeDensity, b.smokeDensity, rnd(0.015, 0.04));
    p.gasLevel = lerp(p.gasLevel, b.gasLevel, rnd(0.01, 0.03));
    p.vibration = lerp(p.vibration, b.vibration, rnd(0.08, 0.15));
    p.waterLeak = lerp(p.waterLeak, b.waterLeak, rnd(0.02, 0.05));
    p.energyUsage = lerp(p.energyUsage, b.energyUsage, rnd(0.01, 0.03));
    p.elevatorOccupancy = lerp(p.elevatorOccupancy, b.elevatorOccupancy, rnd(0.02, 0.05));
    if (p.structuralIntegrity < 0.5) {
      p.elevatorStatus = 'faulty';
    } else if (p.structuralIntegrity < 0.8) {
    }
    if (!this.collapseSources.has(zone)) {
      p.structuralIntegrity = lerp(p.structuralIntegrity, b.structuralIntegrity, rnd(0.001, 0.003));
    }

    // Sprinkler suppression during active fire
    const fireSrc = this.fireSources.get(zone);
    if (p.sprinklerStatus === 'active' && fireSrc) {
      fireSrc.decayRate *= 2; // Faster suppression
      p.fireIntensity *= 0.9; // Immediate effect
      p.temperature *= 0.95;
      p.smokeDensity *= 0.92;
    }

    // Hard clamps
    p.temperature = Math.max(0, Math.min(MAX_TEMP, p.temperature));
    p.smokeDensity = Math.max(0, Math.min(MAX_SMOKE, p.smokeDensity));
    p.gasLevel = Math.max(0, Math.min(MAX_GAS, p.gasLevel));
    p.vibration = Math.max(0, Math.min(MAX_VIB, p.vibration));
    p.fireIntensity = Math.max(0, Math.min(1, p.fireIntensity));
    p.structuralIntegrity = Math.max(0, Math.min(1, p.structuralIntegrity));
    p.waterLeak = Math.max(0, Math.min(100, p.waterLeak));
    p.energyUsage = Math.max(0, Math.min(200, p.energyUsage));
    p.elevatorOccupancy = Math.max(0, Math.min(1, p.elevatorOccupancy));
  }

  private propagateToNeighbours() {
    const deltas = new Map<string, Partial<ZonePhysics>>();

    for (const [srcZone, srcPhysics] of this.physics) {
      const z = srcZone;
      const b = this.baselines.get(z)!;
      const neighbours = this.adjacency[z];
      if (!neighbours) continue;

      for (const nbr of neighbours) {
        // Closer zones (lower weight) imply faster propagation
        const propFactor = BASE_PROPAGATION_FACTOR / Math.max(0.1, nbr.weight);

        const smokeDelta = (srcPhysics.smokeDensity - b.smokeDensity) * propFactor * rnd(0.5, 1.5);
        const tempDelta = (srcPhysics.temperature - b.temperature) * propFactor * 0.3 * rnd(0.5, 1.5);
        const gasDelta = (srcPhysics.gasLevel - b.gasLevel) * propFactor * 0.5 * rnd(0.5, 1.5);

        if (smokeDelta <= 0 && tempDelta <= 0 && gasDelta <= 0) continue;

        const existing = deltas.get(nbr.zone) ?? {};
        existing.smokeDensity = (existing.smokeDensity ?? 0) + smokeDelta;
        existing.temperature = (existing.temperature ?? 0) + tempDelta;
        existing.gasLevel = (existing.gasLevel ?? 0) + gasDelta;
        deltas.set(nbr.zone, existing);
      }
    }

    for (const [zone, delta] of deltas) {
      const p = this.physics.get(zone)!;
      if (delta.smokeDensity) p.smokeDensity = saturate(p.smokeDensity, delta.smokeDensity, MAX_SMOKE);
      if (delta.temperature) p.temperature = saturate(p.temperature, delta.temperature, MAX_TEMP);
      if (delta.gasLevel) p.gasLevel = saturate(p.gasLevel, delta.gasLevel, MAX_GAS);
    }
  }
}

