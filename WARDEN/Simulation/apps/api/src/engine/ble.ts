// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — BLE Positioning Simulation Engine
// On-demand activation per zone during PINPOINT phase
// ═══════════════════════════════════════════════════════════════════════════════

import type { Zone, TrackedPerson, EstimatedPosition, Beacon, PersonRole } from '../types';
import type { GraphData } from '../map/graph';
import { findNearestNode } from '../map/graph';
import { ZONE_BOUNDS } from '../types';
import { rnd, euclidean } from './math-utils';
import type { FaultManager } from '../services/fault-manager';

// ─── Beacon Layout: 5 fixed anchors (4 corners + center) ────────────────────
export const BEACONS: Beacon[] = [
  { id: 'B1', x: 0,   y: 0,   label: 'Top-Left' },
  { id: 'B2', x: 100, y: 0,   label: 'Top-Right' },
  { id: 'B3', x: 0,   y: 100, label: 'Bottom-Left' },
  { id: 'B4', x: 100, y: 100, label: 'Bottom-Right' },
  { id: 'B5', x: 50,  y: 50,  label: 'Center' },
];

function determineZone(x: number, y: number): Zone {
  if (x <= 50 && y <= 50) return 'A';
  if (x > 50 && y <= 50) return 'B';
  if (x <= 50 && y > 50) return 'C';
  return 'D';
}

// ─── RSSI Simulation ──────────────────────────────────────────────────────────
const RSSI_BASE = -40;
const RSSI_FACTOR = 0.5;
const SIGNAL_NOISE = 3.0;

function simulateRSSI(beacon: Beacon, person: TrackedPerson) {
  const dist = euclidean(beacon.x, beacon.y, person.x, person.y);
  const noise = 0; // No noise for deterministic mode
  const rssi = RSSI_BASE - (dist * RSSI_FACTOR) + noise;
  return Math.max(0, (RSSI_BASE - rssi) / RSSI_FACTOR);
}

// ─── Positioning via weighted multi-beacon triangulation ─────────────────────
function estimatePosition(person: TrackedPerson, graphData?: GraphData): EstimatedPosition {
  let totalWeight = 0, wx = 0, wy = 0;
  for (const beacon of BEACONS) {
    const estDist = simulateRSSI(beacon, person);
    const weight = 1 / (estDist + 1);
    wx += beacon.x * weight;
    wy += beacon.y * weight;
    totalWeight += weight;
  }
  const x = Math.round(Math.max(0, Math.min(100, totalWeight > 0 ? wx / totalWeight : person.x)) * 100) / 100;
  const y = Math.round(Math.max(0, Math.min(100, totalWeight > 0 ? wy / totalWeight : person.y)) * 100) / 100;
  const pos: EstimatedPosition = { 
    id: person.id, 
    role: person.role, 
    x, 
    y, 
    zone: determineZone(x, y), 
    timestamp: Date.now(),
    telemetry: person.telemetry ? { ...person.telemetry } : undefined
  };
  if (graphData) {
    const node = findNearestNode(graphData, x, y);
    pos.currentNode = node.id;
  }
  return pos;
}

// ═══════════════════════════════════════════════════════════════════════════════
export class BLEEngine {
  private people: TrackedPerson[] = [];
  private activeZones = new Set<Zone>();
  private initialized = false;
  private faultManager: FaultManager | null;
  private frozenPositions: EstimatedPosition[] | null = null;
  private graphData?: GraphData;

  private floorId: number;

  constructor(floorId: number = 1, faultManager?: FaultManager, graphData?: GraphData) {
    this.floorId = floorId;
    this.faultManager = faultManager ?? null;
    this.graphData = graphData;
  }

  initialize(count: number = 20) {
    this.people = [];
    let idCounter = 0;
    for (let i = 0; i < count; i++) {
      idCounter++;
      const r = i / count; // Deterministic role distribution
      const role: PersonRole = r < 0.7 ? 'guest' : r < 0.9 ? 'staff' : 'responder';
      const prefix = role === 'guest' ? 'G' : role === 'staff' ? 'S' : 'R';
      const x = rnd(5, 95);
      const y = rnd(5, 95);
      const isResponder = role === 'responder';
      this.people.push({
        id: `F${this.floorId}-${prefix}-${String(idCounter).padStart(3, '0')}`,
        role,
        x,
        y,
        vx: rnd(-0.5, 0.5),
        vy: rnd(-0.5, 0.5),
        zone: determineZone(x, y),
        telemetry: isResponder ? {
          heartRate: Math.floor(rnd(75, 95)),
          oxygenLevel: 100,
          stressLevel: rnd(0.1, 0.3),
          isCritical: false
        } : undefined
      });
    }
    this.initialized = true;
  }

  activateZone(zone: Zone) { this.activeZones.add(zone); }
  deactivateZone(zone: Zone) { this.activeZones.delete(zone); }
  getActiveZones(): Zone[] { return [...this.activeZones]; }

  reset(count: number = 25) {
    this.activeZones.clear();
    this.initialize(count);
  }

  /**
   * BLE tick — updates movement for all people but only returns positions
   * for zones that are currently active in PINPOINT mode.
   */
  tick(): EstimatedPosition[] {
    if (!this.initialized) this.initialize();

    // Update movement for all people (deterministic drift)
    for (const person of this.people) {
      const momentum = 0.8;
      const maxSpeed = 2.0;
      // Drift slowly in a circular pattern instead of random
      person.vx = person.vx * momentum + Math.cos(person.x) * (1 - momentum);
      person.vy = person.vy * momentum + Math.sin(person.y) * (1 - momentum);

      const speed = Math.sqrt(person.vx ** 2 + person.vy ** 2);
      if (speed > maxSpeed) {
        person.vx *= maxSpeed / speed;
        person.vy *= maxSpeed / speed;
      }

      person.x += person.vx;
      person.y += person.vy;

      // Boundary bounce
      if (person.x < 0) { person.x = Math.abs(person.x); person.vx = Math.abs(person.vx); }
      if (person.x > 100) { person.x = 200 - person.x; person.vx = -Math.abs(person.vx); }
      if (person.y < 0) { person.y = Math.abs(person.y); person.vy = Math.abs(person.vy); }
      if (person.y > 100) { person.y = 200 - person.y; person.vy = -Math.abs(person.vy); }

      person.x = Math.max(0, Math.min(100, person.x));
      person.y = Math.max(0, Math.min(100, person.y));
      person.zone = determineZone(person.x, person.y);

      // Simulate Telemetry degradation/fluctuation for responders
      if (person.telemetry) {
        person.telemetry.heartRate += rnd(-2, 3); // slight upward trend over time
        person.telemetry.heartRate = Math.max(60, Math.min(180, person.telemetry.heartRate));
        
        person.telemetry.oxygenLevel -= rnd(0.05, 0.15); // steady depletion
        person.telemetry.oxygenLevel = Math.max(0, person.telemetry.oxygenLevel);
        
        person.telemetry.stressLevel += rnd(-0.02, 0.03);
        person.telemetry.stressLevel = Math.max(0, Math.min(1, person.telemetry.stressLevel));

        person.telemetry.isCritical = person.telemetry.oxygenLevel < 20 || person.telemetry.heartRate > 160;
      }
    }

    // Only return positions for active zones
    if (this.activeZones.size === 0) return [];

    let positions = this.people
      .map(p => estimatePosition(p, this.graphData))
      .filter(p => this.activeZones.has(p.zone));

    // ── BLE fault overlays ───────────────────────────────────────────────
    if (this.faultManager) {
      // beacon_loss — lose all positions
      if (this.faultManager.hasFault('ble', 'beacon_loss')) {
        return [];
      }

      // frozen_positions — return stale positions
      if (this.faultManager.hasFault('ble', 'frozen_positions')) {
        if (!this.frozenPositions) {
          this.frozenPositions = positions;
        }
        return this.frozenPositions;
      } else {
        this.frozenPositions = null;
      }

      // partial_blackout — drop a specific zone
      for (const zone of this.activeZones) {
        if (this.faultManager.hasFault('ble', 'partial_blackout', zone)) {
          positions = positions.filter(p => p.zone !== zone);
        }
      }

      // reduced_precision — add jitter to positions
      const severity = this.faultManager.getMaxSeverity('ble');
      if (severity > 0 && this.faultManager.hasFault('ble', 'reduced_precision')) {
        positions = positions.map(p => ({
          ...p,
          x: Math.max(0, Math.min(100, p.x + rnd(-severity * 15, severity * 15))),
          y: Math.max(0, Math.min(100, p.y + rnd(-severity * 15, severity * 15))),
        }));
      }
    }

    return positions;
  }

  /** Get all positions regardless of active zones (for full map view) */
  getAllPositions(): EstimatedPosition[] {
    if (!this.initialized) return [];
    return this.people.map(p => estimatePosition(p, this.graphData));
  }

  getPopulationByZone(): Record<Zone, number> {
    const counts: Record<Zone, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const p of this.people) counts[p.zone]++;
    return counts;
  }

  /** Expose tracked people for evacuation engine */
  getTrackedPeople(): TrackedPerson[] {
    if (!this.initialized) return [];
    return [...this.people];
  }
}
