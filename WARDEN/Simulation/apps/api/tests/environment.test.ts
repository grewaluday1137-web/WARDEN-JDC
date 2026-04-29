import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentEngine } from '../src/engine/environment';

describe('EnvironmentEngine', () => {
  let env: EnvironmentEngine;

  beforeEach(() => {
    env = new EnvironmentEngine();
  });

  describe('Initial State', () => {
    it('starts all zones at baseline physics', () => {
      const physics = env.getAllPhysics();
      for (const zone of ['A', 'B', 'C', 'D'] as const) {
        expect(physics[zone].temperature).toBe(22);
        expect(physics[zone].smokeDensity).toBe(0);
        expect(physics[zone].gasLevel).toBe(5);
        expect(physics[zone].fireIntensity).toBe(0);
        expect(physics[zone].structuralIntegrity).toBe(1.0);
      }
    });

    it('does not alias baseline objects to active physics objects', () => {
      // Modify active physics, baseline must remain pristine
      env.injectIncident('A', 'fire');
      env.tick(); // Apply physics mutations

      // Access private baselines by casting to any (since baselines is private in TS)
      const baselines = (env as any).baselines;
      const baseA = baselines.get('A');
      const physA = env.getPhysics('A');

      // Given an applied fire, the live temperature should be > baseline
      expect(physA.temperature).toBeGreaterThan(baseA.temperature);
      // The baseline should remain untouched at DEFAULT_PHYSICS values
      expect(baseA.temperature).toBe(22);
    });
  });

  describe('Fire Injection', () => {
    it('increases temperature and smoke after fire + ticks', () => {
      const baseline = env.getPhysics('A');
      env.injectIncident('A', 'fire');

      // Run several ticks for fire to grow
      for (let i = 0; i < 10; i++) env.tick();

      const after = env.getPhysics('A');
      expect(after.temperature).toBeGreaterThan(baseline.temperature);
      expect(after.smokeDensity).toBeGreaterThan(baseline.smokeDensity);
      expect(after.fireIntensity).toBeGreaterThan(0);
    });

    it('does not affect uninjected zones significantly', () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 5; i++) env.tick();

      // Zone D is non-adjacent to A, should be minimally affected
      const zoneD = env.getPhysics('D');
      expect(zoneD.fireIntensity).toBe(0);
    });
  });

  describe('Explosion Injection', () => {
    it('causes immediate high vibration and temperature spike', () => {
      const baseline = env.getPhysics('B');
      env.injectIncident('B', 'explosion');

      const after = env.getPhysics('B');
      expect(after.vibration).toBeGreaterThan(baseline.vibration + 1);
      expect(after.temperature).toBeGreaterThan(baseline.temperature + 10);
    });

    it('damages structural integrity', () => {
      env.injectIncident('C', 'explosion');
      const after = env.getPhysics('C');
      expect(after.structuralIntegrity).toBeLessThan(1.0);
    });
  });

  describe('Gas Leak Injection', () => {
    it('raises gas levels significantly', () => {
      const baseline = env.getPhysics('D');
      env.injectIncident('D', 'gas_leak');
      const after = env.getPhysics('D');
      expect(after.gasLevel).toBeGreaterThan(baseline.gasLevel + 50);
    });
  });

  describe('Structural Collapse', () => {
    it('increases vibration and decreases integrity over time', () => {
      env.injectIncident('A', 'structural_collapse');
      for (let i = 0; i < 10; i++) env.tick();

      const after = env.getPhysics('A');
      expect(after.vibration).toBeGreaterThan(0.1);
      expect(after.structuralIntegrity).toBeLessThan(1.0);
    });
  });

  describe('Dissipation', () => {
    it('vibration decays after one-time explosion spike', () => {
      env.injectIncident('A', 'explosion');
      const peak = env.getPhysics('A').vibration;

      // Explosions cause one-time spike; let many ticks pass for dissipation
      for (let i = 0; i < 60; i++) env.tick();

      const decayed = env.getPhysics('A').vibration;
      expect(decayed).toBeLessThan(peak);
    });
  });

  describe('Cross-Zone Propagation', () => {
    it('smoke spreads to adjacent zones', () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 15; i++) env.tick();

      // Zone B is adjacent to A
      const zoneB = env.getPhysics('B');
      expect(zoneB.smokeDensity).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('restores all zones to baseline', () => {
      env.injectIncident('A', 'fire');
      env.injectIncident('B', 'explosion');
      for (let i = 0; i < 10; i++) env.tick();

      env.reset();
      const physics = env.getAllPhysics();
      for (const zone of ['A', 'B', 'C', 'D'] as const) {
        expect(physics[zone].temperature).toBe(22);
        expect(physics[zone].fireIntensity).toBe(0);
      }
    });
  });

  describe('Hard Limits', () => {
    it('temperature never exceeds 120°C', () => {
      env.injectIncident('A', 'fire');
      env.injectIncident('A', 'explosion');
      for (let i = 0; i < 100; i++) env.tick();

      expect(env.getPhysics('A').temperature).toBeLessThanOrEqual(120);
    });

    it('smoke never exceeds 100%', () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 100; i++) env.tick();

      expect(env.getPhysics('A').smokeDensity).toBeLessThanOrEqual(100);
    });
  });
});
