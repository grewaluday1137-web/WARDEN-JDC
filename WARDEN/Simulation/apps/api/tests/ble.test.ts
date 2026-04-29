import { describe, it, expect, beforeEach } from 'vitest';
import { BLEEngine } from '../src/engine/ble';

describe('BLEEngine', () => {
  let ble: BLEEngine;

  beforeEach(() => {
    ble = new BLEEngine();
    ble.initialize(10);
  });

  describe('Initialization', () => {
    it('initializes with correct number of people', () => {
      const positions = ble.getAllPositions();
      expect(positions).toHaveLength(10);
    });

    it('all people have valid zone assignments (Fix #16)', () => {
      const positions = ble.getAllPositions();
      for (const p of positions) {
        expect(['A', 'B', 'C', 'D']).toContain(p.zone);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
    });

    it('assigns roles with correct distribution', () => {
      // With 100 people, distribution should be roughly 70/20/10
      ble.initialize(100);
      const positions = ble.getAllPositions();
      const roles = positions.map(p => p.role);
      const guests = roles.filter(r => r === 'guest').length;
      expect(guests).toBeGreaterThan(40); // at least 40% should be guests
    });
  });

  describe('Zone Activation', () => {
    it('returns no positions when no zones active', () => {
      const positions = ble.tick();
      expect(positions).toHaveLength(0);
    });

    it('returns positions only for active zones', () => {
      ble.activateZone('A');
      const positions = ble.tick();
      for (const p of positions) {
        expect(p.zone).toBe('A');
      }
    });

    it('tracks active zones correctly', () => {
      ble.activateZone('A');
      ble.activateZone('C');
      expect(ble.getActiveZones()).toContain('A');
      expect(ble.getActiveZones()).toContain('C');
      expect(ble.getActiveZones()).not.toContain('B');
    });

    it('deactivates zones correctly', () => {
      ble.activateZone('A');
      ble.deactivateZone('A');
      expect(ble.getActiveZones()).not.toContain('A');
    });
  });

  describe('Movement', () => {
    it('people move between ticks', () => {
      ble.activateZone('A');
      ble.activateZone('B');
      ble.activateZone('C');
      ble.activateZone('D');

      const before = ble.tick();
      const after = ble.tick();

      // At least some positions should have changed
      let moved = 0;
      for (let i = 0; i < Math.min(before.length, after.length); i++) {
        const b = before.find(p => p.id === after[i]?.id);
        if (b && (b.x !== after[i].x || b.y !== after[i].y)) moved++;
      }
      expect(moved).toBeGreaterThan(0);
    });

    it('people stay within bounds', () => {
      ble.activateZone('A');
      ble.activateZone('B');
      ble.activateZone('C');
      ble.activateZone('D');

      for (let i = 0; i < 50; i++) ble.tick();

      const all = ble.getAllPositions();
      for (const p of all) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Population Count', () => {
    it('returns population counts by zone', () => {
      const counts = ble.getPopulationByZone();
      expect(counts.A + counts.B + counts.C + counts.D).toBe(10);
    });
  });

  describe('Reset', () => {
    it('clears active zones and reinitializes', () => {
      ble.activateZone('A');
      ble.activateZone('B');
      ble.reset(15);

      expect(ble.getActiveZones()).toHaveLength(0);
      expect(ble.getAllPositions()).toHaveLength(15);
    });
  });
});
