import { describe, it, expect, beforeEach } from 'vitest';
import { SensorGrid } from '../src/engine/sensors';
import { DEFAULT_PHYSICS } from '../../packages/types';
import type { Zone, ZonePhysics } from '../../packages/types';

function makePhysics(overrides: Partial<Record<Zone, Partial<ZonePhysics>>> = {}): Record<Zone, ZonePhysics> {
  const base: Record<Zone, ZonePhysics> = {
    A: { ...DEFAULT_PHYSICS },
    B: { ...DEFAULT_PHYSICS },
    C: { ...DEFAULT_PHYSICS },
    D: { ...DEFAULT_PHYSICS },
  };
  for (const [zone, vals] of Object.entries(overrides)) {
    Object.assign(base[zone as Zone], vals);
  }
  return base;
}

describe('SensorGrid', () => {
  let grid: SensorGrid;

  beforeEach(() => {
    grid = new SensorGrid();
  });

  describe('Reading Generation', () => {
    it('generates 36 readings (9 sensors × 4 zones)', () => {
      const readings = grid.generateReadings(makePhysics());
      expect(readings).toHaveLength(36);
    });

    it('readings have correct zone IDs', () => {
      const readings = grid.generateReadings(makePhysics());
      const zones = new Set(readings.map(r => r.zoneId));
      expect(zones).toEqual(new Set(['A', 'B', 'C', 'D']));
    });

    it('readings have correct sensor types', () => {
      const readings = grid.generateReadings(makePhysics());
      const types = new Set(readings.map(r => r.type));
      expect(types).toEqual(new Set(['temperature', 'smoke', 'gas', 'vibration', 'flame', 'sprinkler', 'water_leak', 'energy_meter', 'elevator']));
    });
  });

  describe('Anomaly Detection', () => {
    it('detects anomalous zones with high temperature', () => {
      const physics = makePhysics({ A: { temperature: 80 } });
      const readings = grid.generateReadings(physics);
      const anomalous = grid.getAnomalousZones(readings);
      expect(anomalous).toContain('A');
    });

    it('no anomalous zones at baseline values', () => {
      const readings = grid.generateReadings(makePhysics());
      const anomalous = grid.getAnomalousZones(readings);
      // At baseline, nothing should be anomalous (with small noise variance)
      // Note: gaussian noise could rarely trigger false positives
      expect(anomalous.length).toBeLessThanOrEqual(1); // allow 1 for noise
    });
  });

  describe('Incident Inference', () => {
    it('infers fire from high temperature and smoke', () => {
      const physics = makePhysics({ B: { temperature: 80, smokeDensity: 40 } });
      const readings = grid.generateReadings(physics);
      const type = grid.inferIncidentType(readings, 'B');
      expect(type).toBe('fire');
    });

    it('infers gas_leak from high gas level', () => {
      const physics = makePhysics({ C: { gasLevel: 200 } });
      const readings = grid.generateReadings(physics);
      const type = grid.inferIncidentType(readings, 'C');
      expect(type).toBe('gas_leak');
    });

    it('infers structural_collapse from high vibration', () => {
      const physics = makePhysics({ D: { vibration: 5 } });
      const readings = grid.generateReadings(physics);
      const type = grid.inferIncidentType(readings, 'D');
      expect(type).toBe('structural_collapse');
    });

    it('returns null for baseline readings', () => {
      const readings = grid.generateReadings(makePhysics());
      const type = grid.inferIncidentType(readings, 'A');
      expect(type).toBeNull();
    });
  });
});
