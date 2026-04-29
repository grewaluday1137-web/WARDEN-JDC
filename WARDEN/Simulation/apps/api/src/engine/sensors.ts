// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Sensor Reading Generator
// Observes zone physics and produces sensor readings with anomaly detection
// ═══════════════════════════════════════════════════════════════════════════════

import type { Zone, ZonePhysics, SensorReading, SensorType } from '../types';
import type { GraphData } from '../map/graph';
import { findNearestNode } from '../map/graph';
import { gaussian } from './math-utils';
import type { FaultManager } from '../services/fault-manager';

// ─── Sensor Definitions per Zone ──────────────────────────────────────────────
interface SensorDef {
  id: string;
  zone: Zone;
  type: SensorType;
  unit: string;
  physicsKey: keyof ZonePhysics;
  noiseStd: number;
  anomalyThreshold: number;
  x: number;
  y: number;
  nodeId?: string;
}

// Default zone centers (fallback when no graph data)
const DEFAULT_ZONE_CENTERS: Record<string, { x: number; y: number }> = {
  A: { x: 25, y: 25 },
  B: { x: 75, y: 25 },
  C: { x: 25, y: 75 },
  D: { x: 75, y: 75 },
};

function buildSensorsForZones(zones: string[], graphData?: GraphData): SensorDef[] {
  const defs: SensorDef[] = [];

  // Compute zone centers from graph data if available
  const centers: Record<string, { x: number; y: number }> = {};
  if (graphData) {
    for (const node of graphData.nodes.values()) {
      const z = node.parentZone;
      if (!centers[z]) {
        centers[z] = { x: 0, y: 0 };
      }
    }
    // Calculate center as average of all node positions in each zone
    const counts: Record<string, number> = {};
    for (const node of graphData.nodes.values()) {
      const z = node.parentZone;
      counts[z] = (counts[z] || 0) + 1;
      centers[z].x += node.x;
      centers[z].y += node.y;
    }
    for (const z of Object.keys(centers)) {
      if (counts[z]) {
        centers[z].x /= counts[z];
        centers[z].y /= counts[z];
      }
    }
  }

  for (const z of zones) {
    const { x, y } = centers[z] || DEFAULT_ZONE_CENTERS[z] || { x: 50, y: 50 };
    defs.push(
      { id: `TEMP-${z}`, zone: z, type: 'temperature', unit: '°C', physicsKey: 'temperature', noiseStd: 0.8, anomalyThreshold: 45, x, y },
      { id: `SMOKE-${z}`, zone: z, type: 'smoke', unit: '%', physicsKey: 'smokeDensity', noiseStd: 1.5, anomalyThreshold: 15, x, y },
      { id: `GAS-${z}`, zone: z, type: 'gas', unit: 'ppm', physicsKey: 'gasLevel', noiseStd: 3, anomalyThreshold: 50, x, y },
      { id: `VIB-${z}`, zone: z, type: 'vibration', unit: 'g', physicsKey: 'vibration', noiseStd: 0.01, anomalyThreshold: 0.5, x, y },
      { id: `FLAME-${z}`, zone: z, type: 'flame', unit: 'idx', physicsKey: 'fireIntensity', noiseStd: 0.02, anomalyThreshold: 0.2, x, y },
      { id: `SPRINKLER-${z}`, zone: z, type: 'sprinkler' as SensorType, unit: '%', physicsKey: 'sprinklerStatus', noiseStd: 0, anomalyThreshold: 0.5, x, y },
      { id: `WATER-${z}`, zone: z, type: 'water_leak', unit: '%', physicsKey: 'waterLeak', noiseStd: 1.0, anomalyThreshold: 20, x, y },
      { id: `ENERGY-${z}`, zone: z, type: 'energy_meter', unit: 'kW', physicsKey: 'energyUsage', noiseStd: 0.5, anomalyThreshold: 120, x, y },
      { id: `ELEV-${z}`, zone: z, type: 'elevator', unit: '%', physicsKey: 'elevatorStatus', noiseStd: 0, anomalyThreshold: 50, x, y },
    );
  }
  return defs;
}

export class SensorGrid {
  private sensors: SensorDef[];
  private faultManager: FaultManager | null;
  private graphData?: GraphData;

  constructor(faultManager?: FaultManager, graphData?: GraphData, zones?: string[]) {
    this.faultManager = faultManager ?? null;
    this.graphData = graphData;

    // Build sensors for the actual zones present in the graph data
    const activeZones = zones ?? this.discoverZones();
    this.sensors = buildSensorsForZones(activeZones, graphData);

    if (this.graphData) {
      for (const s of this.sensors) {
        const nearest = findNearestNode(this.graphData, s.x, s.y);
        s.nodeId = nearest.id;
      }
    }
  }

  /** Discover zones from graph data or fallback to A-D */
  private discoverZones(): string[] {
    if (this.graphData) {
      const zones = new Set<string>();
      for (const node of this.graphData.nodes.values()) {
        zones.add(node.parentZone);
      }
      return Array.from(zones).sort();
    }
    return ['A', 'B', 'C', 'D'];
  }

  generateReadings(allPhysics: Record<Zone, ZonePhysics>): SensorReading[] {
    const readings: SensorReading[] = [];
    const now = Date.now();

    for (const sensor of this.sensors) {
      const physics = allPhysics[sensor.zone];
      if (!physics) continue;

      // Check for 'missing' fault — sensor drops out entirely
      if (this.faultManager?.hasFault('sensor', 'missing', sensor.zone)) {
        continue;
      }

      let trueValue = (physics[sensor.physicsKey] as any);
      if (sensor.physicsKey === 'sprinklerStatus') {
        trueValue = trueValue === 'active' ? 100 : trueValue === 'faulty' ? 75 : 0;
      } else if (sensor.physicsKey === 'elevatorStatus') {
        trueValue = trueValue === 'normal' ? 0 : trueValue === 'warning' ? 50 : 100;
      }

      let noisy = Math.max(0, trueValue + gaussian(sensor.noiseStd));

      // ── Fault overlays ──────────────────────────────────────────────────
      if (this.faultManager) {
        const severity = this.faultManager.getMaxSeverity('sensor', sensor.zone);

        if (this.faultManager.hasFault('sensor', 'stuck_high', sensor.zone)) {
          // Sensor reads at or near its anomaly threshold regardless of reality
          noisy = sensor.anomalyThreshold * (1 + severity * 0.5);
        } else if (this.faultManager.hasFault('sensor', 'stuck_low', sensor.zone)) {
          // Sensor reads near zero regardless of reality
          noisy = trueValue * (1 - severity) * 0.1;
        } else if (this.faultManager.hasFault('sensor', 'noisy', sensor.zone)) {
          // Inject extra noise proportional to severity
          const extraNoise = severity * sensor.anomalyThreshold * 0.5;
          noisy += gaussian(extraNoise);
          noisy = Math.max(0, noisy);
        } else if (this.faultManager.hasFault('sensor', 'delayed', sensor.zone)) {
          // For delayed, we just reduce the value toward baseline (simulating stale data)
          noisy = noisy * (1 - severity * 0.6);
        }
      }

      readings.push({
        sensorId: sensor.id,
        zoneId: sensor.zone,
        nodeId: sensor.nodeId,
        type: sensor.type,
        value: Math.round(noisy * 100) / 100,
        unit: sensor.unit,
        timestamp: now,
        isAnomalous: noisy >= sensor.anomalyThreshold,
      });
    }

    return readings;
  }

  /** Check if any sensor in a zone shows anomalous readings */
  getAnomalousZones(readings: SensorReading[]): Zone[] {
    const anomalous = new Set<Zone>();
    for (const r of readings) {
      if (r.isAnomalous) anomalous.add(r.zoneId);
    }
    return [...anomalous];
  }

  /** Infer likely incident type from sensor readings in a zone */
  inferIncidentType(readings: SensorReading[], zone: Zone): import('../types').IncidentType | null {
    const zoneReadings = readings.filter(r => r.zoneId === zone && r.isAnomalous);
    
    // Strict per-sensor priority
    const gasHigh = zoneReadings.some(r => r.type === 'gas' && r.value > 100);
    const vibExtreme = zoneReadings.some(r => r.type === 'vibration' && r.value > 2);
    const flameActive = zoneReadings.some(r => r.type === 'flame' && r.value > 0.1);
    const tempHigh = zoneReadings.some(r => r.type === 'temperature' && r.value > 65);
    const smokeHigh = zoneReadings.some(r => r.type === 'smoke' && r.value > 25);
    const vibHigh = zoneReadings.some(r => r.type === 'vibration' && r.value > 0.8);

    if (gasHigh) return 'gas_leak';
    if (vibExtreme) return 'structural_collapse';
    if (flameActive || (tempHigh && smokeHigh)) return 'fire';
    if (vibHigh) return 'explosion';

    return null;
  }
}
