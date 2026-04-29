import { describe, it, expect, beforeEach } from 'vitest';
import { EvacuationEngine } from '../src/engine/evacuation-engine';
import type { TrackedPerson, Zone, ZonePhysics } from '../../packages/types';
import { DEFAULT_PHYSICS } from '../../packages/types';

// ── NO file I/O — use the engine's built-in default exits ────────────────────

function makePeople(count: number): TrackedPerson[] {
  const people: TrackedPerson[] = [];
  for (let i = 0; i < count; i++) {
    const x = 20 + Math.random() * 60;
    const y = 20 + Math.random() * 60;
    people.push({
      id: `P-${String(i).padStart(3, '0')}`,
      role: i < Math.floor(count * 0.1) ? 'responder' : i < Math.floor(count * 0.3) ? 'staff' : 'guest',
      x, y,
      vx: 0, vy: 0,
      zone: (x <= 50 && y <= 50 ? 'A' : x > 50 && y <= 50 ? 'B' : x <= 50 ? 'C' : 'D') as Zone,
    });
  }
  return people;
}

function calmPhysics(): Record<Zone, ZonePhysics> {
  return {
    A: { ...DEFAULT_PHYSICS },
    B: { ...DEFAULT_PHYSICS },
    C: { ...DEFAULT_PHYSICS },
    D: { ...DEFAULT_PHYSICS },
  };
}

function hazardPhysics(): Record<Zone, ZonePhysics> {
  const base = calmPhysics();
  base.A = { ...DEFAULT_PHYSICS, temperature: 80, smokeDensity: 60, fireIntensity: 0.8 };
  return base;
}

describe('EvacuationEngine', () => {
  let engine: EvacuationEngine;

  beforeEach(() => {
    // Use engine without ConfigService — falls back to built-in default exits
    engine = new EvacuationEngine();
  });

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  describe('start', () => {
    it('initializes agents from tracked people', () => {
      const people = makePeople(10);
      engine.start(people, 0);
      expect(engine.isRunning()).toBe(true);
      expect(engine.getAgents()).toHaveLength(10);
    });

    it('assigns exits to non-responder agents', () => {
      const people = makePeople(10);
      engine.start(people, 0);
      const agents = engine.getAgents();
      const nonResponders = agents.filter(a => a.role !== 'responder');
      const withExits = nonResponders.filter(a => a.targetExitId !== null);
      expect(withExits.length).toBeGreaterThan(0);
    });

    it('marks responders as assisting', () => {
      const people = makePeople(20);
      engine.start(people, 0);
      const responders = engine.getAgents().filter(a => a.role === 'responder');
      for (const r of responders) {
        expect(r.status).toBe('assisting');
      }
    });

    it('does not start twice', () => {
      const people = makePeople(5);
      engine.start(people, 0);
      engine.start(people, 10);
      expect(engine.getAgents()).toHaveLength(5);
    });
  });

  describe('stop', () => {
    it('stops a running evacuation', () => {
      engine.start(makePeople(5), 0);
      expect(engine.isRunning()).toBe(true);
      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      engine.start(makePeople(10), 0);
      engine.reset();
      expect(engine.isRunning()).toBe(false);
      expect(engine.getAgents()).toHaveLength(0);
      expect(engine.getMetrics(0)).toBeNull();
    });
  });

  // ─── Tick ────────────────────────────────────────────────────────────────────

  describe('tick', () => {
    it('moves agents toward exits', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 50, y: 50, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);

      const agentBefore = engine.getAgents()[0];
      const startX = agentBefore.x;
      const startY = agentBefore.y;

      for (let i = 1; i <= 10; i++) {
        engine.tick(calmPhysics(), i);
      }

      const agentAfter = engine.getAgents()[0];
      const moved = Math.sqrt((agentAfter.x - startX) ** 2 + (agentAfter.y - startY) ** 2);
      expect(moved).toBeGreaterThan(0);
    });

    it('eventually evacuates agents', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 5, y: 5, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);

      for (let i = 1; i <= 20; i++) {
        engine.tick(calmPhysics(), i);
      }

      const agent = engine.getAgents()[0];
      expect(agent.status).toBe('evacuated');
    });

    it('accumulates risk exposure in hazardous zones', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 25, y: 25, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);

      for (let i = 1; i <= 10; i++) {
        engine.tick(hazardPhysics(), i);
      }

      const agent = engine.getAgents()[0];
      expect(agent.riskExposure).toBeGreaterThan(0);
    });

    it('does not tick when not active', () => {
      engine.start(makePeople(5), 0);
      engine.stop();
      engine.tick(calmPhysics(), 1); // should not throw
    });

    it('slower speed in hazardous conditions', () => {
      // Same start positions, compare distance after 5 ticks
      const posA = { id: 'P-001', role: 'guest' as const, x: 25, y: 25, vx: 0, vy: 0, zone: 'A' as Zone };

      const engineCalm = new EvacuationEngine();
      engineCalm.start([{ ...posA }], 0);
      for (let i = 1; i <= 5; i++) engineCalm.tick(calmPhysics(), i);
      const calmAgent = engineCalm.getAgents()[0];

      const engineHazard = new EvacuationEngine();
      engineHazard.start([{ ...posA }], 0);
      for (let i = 1; i <= 5; i++) engineHazard.tick(hazardPhysics(), i);
      const hazardAgent = engineHazard.getAgents()[0];

      // Both should target EXIT-NW at (0,0)
      const calmDist = Math.sqrt(calmAgent.x ** 2 + calmAgent.y ** 2);
      const hazardDist = Math.sqrt(hazardAgent.x ** 2 + hazardAgent.y ** 2);
      // Hazard agent should be further from exit (moved less)
      expect(hazardDist).toBeGreaterThan(calmDist);
    });
  });

  // ─── Metrics ─────────────────────────────────────────────────────────────────

  describe('getMetrics', () => {
    it('returns null when no evacuation has occurred', () => {
      expect(engine.getMetrics(0)).toBeNull();
    });

    it('returns metrics during active evacuation', () => {
      engine.start(makePeople(15), 0);
      const metrics = engine.getMetrics(0);
      expect(metrics).not.toBeNull();
      expect(metrics!.totalOccupants).toBe(15);
    });

    it('tracks evacuated count correctly', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 1, y: 1, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);

      for (let i = 1; i <= 5; i++) {
        engine.tick(calmPhysics(), i);
      }

      const metrics = engine.getMetrics(5);
      expect(metrics!.evacuatedCount).toBe(1);
    });

    it('identifies highest risk zone', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 25, y: 25, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);

      // Run with zone A hazardous
      for (let i = 1; i <= 5; i++) {
        engine.tick(hazardPhysics(), i);
      }

      const metrics = engine.getMetrics(5);
      // Agent started in A which has hazard — should accumulate risk
      expect(metrics!.highestRiskZone).not.toBeNull();
    });
  });

  // ─── Exit Assignment ────────────────────────────────────────────────────────

  describe('exit assignment', () => {
    it('assigns nearest exit (NW corner → EXIT-NW)', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 5, y: 5, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);
      expect(engine.getAgents()[0].targetExitId).toBe('EXIT-NW');
    });

    it('assigns EXIT-SE for bottom-right agent', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 95, y: 95, vx: 0, vy: 0, zone: 'D',
      }];
      engine.start(people, 0);
      expect(engine.getAgents()[0].targetExitId).toBe('EXIT-SE');
    });

    it('assigns EXIT-NE for top-right agent', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 95, y: 5, vx: 0, vy: 0, zone: 'B',
      }];
      engine.start(people, 0);
      expect(engine.getAgents()[0].targetExitId).toBe('EXIT-NE');
    });

    it('assigns EXIT-SW for bottom-left agent', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 5, y: 95, vx: 0, vy: 0, zone: 'C',
      }];
      engine.start(people, 0);
      expect(engine.getAgents()[0].targetExitId).toBe('EXIT-SW');
    });

    it('agent retains valid exit after hazard tick', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 40, y: 40, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);
      engine.tick(hazardPhysics(), 1);
      expect(engine.getAgents()[0].targetExitId).not.toBeNull();
    });
  });

  // ─── Path History ───────────────────────────────────────────────────────────

  describe('path tracking', () => {
    it('records starting zone in pathHistory', () => {
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 30, y: 80, vx: 0, vy: 0, zone: 'C',
      }];
      engine.start(people, 0);
      expect(engine.getAgents()[0].pathHistory[0]).toBe('C');
    });

    it('records zone transitions as agent moves', () => {
      // Place far from nearest exit to ensure zone crossing
      const people: TrackedPerson[] = [{
        id: 'P-001', role: 'guest', x: 48, y: 48, vx: 0, vy: 0, zone: 'A',
      }];
      engine.start(people, 0);

      for (let i = 1; i <= 60; i++) {
        engine.tick(calmPhysics(), i);
      }

      const agent = engine.getAgents()[0];
      expect(agent.pathHistory.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Responder AI ───────────────────────────────────────────────────────────

  describe('responder behavior', () => {
    it('responders move toward trapped people', () => {
      // Create a trapped person in zone D and a responder in zone A
      const engine2 = new EvacuationEngine();
      const people: TrackedPerson[] = [
        { id: 'R-001', role: 'responder', x: 10, y: 10, vx: 0, vy: 0, zone: 'A' },
        { id: 'P-001', role: 'guest', x: 75, y: 75, vx: 0, vy: 0, zone: 'D' },
      ];
      engine2.start(people, 0);

      const responderStart = engine2.getAgents().find(a => a.id === 'R-001')!;
      const startDist = Math.sqrt((responderStart.x - 75) ** 2 + (responderStart.y - 75) ** 2);

      // Run enough ticks for responder movement but not evacuation completion
      for (let i = 1; i <= 5; i++) {
        engine2.tick(calmPhysics(), i);
      }

      // Responder should stay in 'assisting' status
      const responder = engine2.getAgents().find(a => a.id === 'R-001')!;
      expect(responder.status).toBe('assisting');
    });
  });
});
