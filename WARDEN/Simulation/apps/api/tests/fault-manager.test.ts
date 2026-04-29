import { describe, it, expect, beforeEach } from 'vitest';
import { FaultManager } from '../src/services/fault-manager';

describe('FaultManager', () => {
  let fm: FaultManager;

  beforeEach(() => {
    fm = new FaultManager();
  });

  // ─── Injection ───────────────────────────────────────────────────────────────

  describe('inject', () => {
    it('adds a fault and returns the injection record', () => {
      const fault = fm.inject({ subsystem: 'sensor', mode: 'stuck_high', severity: 0.5 }, 10);
      expect(fault.id).toMatch(/^FAULT-/);
      expect(fault.subsystem).toBe('sensor');
      expect(fault.mode).toBe('stuck_high');
      expect(fault.severity).toBe(0.5);
      expect(fault.startedAtTick).toBe(10);
      expect(fault.targetZone).toBeUndefined();
    });

    it('accepts zone-targeted faults', () => {
      const fault = fm.inject({ subsystem: 'ble', mode: 'beacon_loss', severity: 1.0, targetZone: 'A' }, 5);
      expect(fault.targetZone).toBe('A');
    });

    it('accepts timed faults with duration', () => {
      const fault = fm.inject({ subsystem: 'cv', mode: 'unavailable', severity: 0.8, durationTicks: 60 }, 0);
      expect(fault.durationTicks).toBe(60);
    });

    it('rejects severity above 1 (Zod validation)', () => {
      expect(() => fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 1.5 }, 0)).toThrow();
    });

    it('rejects invalid subsystem', () => {
      expect(() => fm.inject({ subsystem: 'invalid' as any, mode: 'stuck_high', severity: 0.5 }, 0)).toThrow();
    });

    it('rejects invalid mode', () => {
      expect(() => fm.inject({ subsystem: 'sensor', mode: 'nonexistent' as any, severity: 0.5 }, 0)).toThrow();
    });

    it('increments totalInjected counter', () => {
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.3 }, 0);
      fm.inject({ subsystem: 'cv', mode: 'unavailable', severity: 0.5 }, 0);
      expect(fm.getState().totalInjected).toBe(2);
    });
  });

  // ─── Clearing ────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes a specific fault by ID', () => {
      const fault = fm.inject({ subsystem: 'sensor', mode: 'stuck_high', severity: 0.5 }, 0);
      expect(fm.getActiveFaults()).toHaveLength(1);
      expect(fm.clear(fault.id)).toBe(true);
      expect(fm.getActiveFaults()).toHaveLength(0);
    });

    it('returns false for non-existent fault ID', () => {
      expect(fm.clear('non-existent')).toBe(false);
    });

    it('increments totalCleared counter', () => {
      const fault = fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.3 }, 0);
      fm.clear(fault.id);
      expect(fm.getState().totalCleared).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('removes all active faults', () => {
      fm.inject({ subsystem: 'sensor', mode: 'stuck_high', severity: 0.5 }, 0);
      fm.inject({ subsystem: 'cv', mode: 'unavailable', severity: 0.8 }, 0);
      fm.inject({ subsystem: 'ble', mode: 'beacon_loss', severity: 1.0 }, 0);
      expect(fm.clearAll()).toBe(3);
      expect(fm.getActiveFaults()).toHaveLength(0);
    });

    it('returns 0 when no faults active', () => {
      expect(fm.clearAll()).toBe(0);
    });
  });

  // ─── Tick (auto-expiry) ──────────────────────────────────────────────────────

  describe('tick', () => {
    it('expires faults that exceed their duration', () => {
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.5, durationTicks: 10 }, 0);
      fm.inject({ subsystem: 'cv', mode: 'unavailable', severity: 0.8, durationTicks: 20 }, 0);

      fm.tick(9);
      expect(fm.getActiveFaults()).toHaveLength(2);

      fm.tick(10);
      expect(fm.getActiveFaults()).toHaveLength(1);
      expect(fm.getActiveFaults()[0].subsystem).toBe('cv');

      fm.tick(20);
      expect(fm.getActiveFaults()).toHaveLength(0);
    });

    it('does not expire permanent faults', () => {
      fm.inject({ subsystem: 'sensor', mode: 'stuck_high', severity: 1.0 }, 0); // no durationTicks
      fm.tick(1000);
      expect(fm.getActiveFaults()).toHaveLength(1);
    });
  });

  // ─── Query API ───────────────────────────────────────────────────────────────

  describe('getFaults', () => {
    it('filters by subsystem', () => {
      fm.inject({ subsystem: 'sensor', mode: 'stuck_high', severity: 0.5 }, 0);
      fm.inject({ subsystem: 'cv', mode: 'unavailable', severity: 0.8 }, 0);
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.3, targetZone: 'B' }, 0);

      // getFaults with no zone returns only global faults for that subsystem
      // + zone-targeted faults won't match unless zone is specified
      expect(fm.getFaults('sensor')).toHaveLength(1); // only the global one
      expect(fm.getFaults('sensor', 'B')).toHaveLength(2); // global + zone B
      expect(fm.getFaults('cv')).toHaveLength(1);
      expect(fm.getFaults('ble')).toHaveLength(0);
    });

    it('filters by zone (includes global faults)', () => {
      fm.inject({ subsystem: 'sensor', mode: 'stuck_high', severity: 0.5 }, 0); // global
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.3, targetZone: 'A' }, 0);
      fm.inject({ subsystem: 'sensor', mode: 'missing', severity: 1, targetZone: 'B' }, 0);

      // Zone A gets global + zone-specific
      expect(fm.getFaults('sensor', 'A')).toHaveLength(2);
      // Zone B gets global + zone-specific
      expect(fm.getFaults('sensor', 'B')).toHaveLength(2);
      // Zone C gets only global
      expect(fm.getFaults('sensor', 'C')).toHaveLength(1);
    });
  });

  describe('hasFault', () => {
    it('returns true when a matching fault exists', () => {
      fm.inject({ subsystem: 'cv', mode: 'false_positive', severity: 0.5, targetZone: 'A' }, 0);
      expect(fm.hasFault('cv', 'false_positive', 'A')).toBe(true);
    });

    it('returns false when no matching fault', () => {
      expect(fm.hasFault('cv', 'false_positive')).toBe(false);
    });

    it('global faults match any zone', () => {
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.5 }, 0); // global
      expect(fm.hasFault('sensor', 'noisy', 'A')).toBe(true);
      expect(fm.hasFault('sensor', 'noisy', 'D')).toBe(true);
    });
  });

  describe('getMaxSeverity', () => {
    it('returns max severity of matching faults', () => {
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.3 }, 0);
      fm.inject({ subsystem: 'sensor', mode: 'stuck_high', severity: 0.9 }, 0);
      expect(fm.getMaxSeverity('sensor')).toBe(0.9);
    });

    it('returns 0 when no faults for subsystem', () => {
      expect(fm.getMaxSeverity('ble')).toBe(0);
    });
  });

  // ─── State & Reset ───────────────────────────────────────────────────────────

  describe('getState', () => {
    it('returns full state snapshot', () => {
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.5 }, 0);
      const state = fm.getState();
      expect(state.activeFailures).toHaveLength(1);
      expect(state.totalInjected).toBe(1);
      expect(state.totalCleared).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears everything', () => {
      fm.inject({ subsystem: 'sensor', mode: 'noisy', severity: 0.5 }, 0);
      fm.inject({ subsystem: 'cv', mode: 'unavailable', severity: 0.8 }, 0);
      fm.reset();

      const state = fm.getState();
      expect(state.activeFailures).toHaveLength(0);
      expect(state.totalInjected).toBe(0);
      expect(state.totalCleared).toBe(0);
    });
  });
});
