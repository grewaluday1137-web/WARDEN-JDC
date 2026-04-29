import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachine } from '../src/engine/state-machine';

describe('StateMachine', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  describe('Initial State', () => {
    it('starts all zones in STANDBY', () => {
      const states = sm.getAllStates();
      for (const zone of ['A', 'B', 'C', 'D'] as const) {
        expect(states[zone].phase).toBe('STANDBY');
        expect(states[zone].incidentType).toBeNull();
        expect(states[zone].confidence).toBe(0);
      }
    });

    it('has no events initially', () => {
      expect(sm.getRecentEvents()).toHaveLength(0);
    });

    it('has no playbook actions initially', () => {
      expect(sm.getPlaybook()).toHaveLength(0);
    });
  });

  describe('Trigger', () => {
    it('transitions zone to TRIGGERED on trigger', () => {
      sm.trigger('A', 'fire');
      const state = sm.getZoneState('A');
      expect(state.phase).toBe('TRIGGERED');
      expect(state.incidentType).toBe('fire');
      expect(state.confidence).toBe(0.4);
    });

    it('does not re-trigger an already triggered zone', () => {
      sm.trigger('A', 'fire');
      sm.trigger('A', 'explosion'); // should be ignored
      const state = sm.getZoneState('A');
      expect(state.incidentType).toBe('fire'); // still fire
    });

    it('creates a warning event on trigger', () => {
      sm.trigger('B', 'gas_leak');
      const events = sm.getRecentEvents();
      expect(events.length).toBe(1);
      expect(events[0].severity).toBe('warning');
      expect(events[0].zone).toBe('B');
    });

    it('triggers different zones independently', () => {
      sm.trigger('A', 'fire');
      sm.trigger('C', 'explosion');
      expect(sm.getZoneState('A').incidentType).toBe('fire');
      expect(sm.getZoneState('C').incidentType).toBe('explosion');
      expect(sm.getZoneState('B').phase).toBe('STANDBY');
    });
  });

  describe('CV Confirmation', () => {
    it('transitions to CONFIRMING on requestCVConfirmation', () => {
      sm.trigger('A', 'fire');
      const sent = sm.requestCVConfirmation('A');
      expect(sent).toBe(true);
      expect(sm.getZoneState('A').phase).toBe('CONFIRMING');
    });

    it('returns false if zone not in TRIGGERED', () => {
      expect(sm.requestCVConfirmation('A')).toBe(false);
    });

    it('escalates to PINPOINT on confirmed CV result', () => {
      sm.trigger('A', 'fire');
      sm.requestCVConfirmation('A');
      sm.receiveCVResult({
        zoneId: 'A', confirmed: true, confidence: 0.85,
        detectionType: 'fire', signals: ['flame_detected'], timestamp: Date.now(),
      });
      expect(sm.getZoneState('A').phase).toBe('PINPOINT');
      expect(sm.getPlaybook().length).toBeGreaterThan(0);
    });

    it('returns to STANDBY on unconfirmed CV result', () => {
      sm.trigger('B', 'gas_leak');
      sm.requestCVConfirmation('B');
      sm.receiveCVResult({
        zoneId: 'B', confirmed: false, confidence: 0.3,
        detectionType: 'gas_leak', signals: [], timestamp: Date.now(),
      });
      expect(sm.getZoneState('B').phase).toBe('STANDBY');
    });

    it('ignores stale CV responses from previous cycle (Fix #7)', () => {
      sm.trigger('A', 'fire');
      sm.requestCVConfirmation('A');
      const oldCycle = sm.getZoneCycleId('A');

      // Resolve the incident (this resets the zone)
      sm.resolveIncident('A');

      // A new incident triggers in the same zone (new cycle)
      // Wait for cooldown to expire (mock by accessing internals)
      sm.trigger('A', 'explosion'); // will be blocked by cooldown
      
      // The old CV result arrives — should be ignored
      sm.receiveCVResult({
        zoneId: 'A', confirmed: true, confidence: 0.9,
        detectionType: 'fire', signals: ['flame_detected'], timestamp: Date.now(),
      }, oldCycle);

      // Zone should NOT be in PINPOINT from the stale response
      const state = sm.getZoneState('A');
      expect(state.phase).not.toBe('PINPOINT');
    });
  });

  describe('CV Timeout', () => {
    beforeEach(() => {
      import('vitest').then(({ vi }) => vi.useFakeTimers());
    });

    it('escalates to MANUAL_REVIEW on timeout', async () => {
      const { vi } = await import('vitest');
      
      sm.trigger('A', 'fire');
      sm.requestCVConfirmation('A');

      const triggeredState = sm.getZoneState('A');
      expect(triggeredState.phase).toBe('CONFIRMING');

      // Advance time beyond the 10000ms timeout
      vi.advanceTimersByTime(15000);
      
      const timedOut = sm.checkCVTimeouts();
      
      expect(timedOut).toContain('A');
      const finalState = sm.getZoneState('A');
      expect(finalState.phase).toBe('MANUAL_REVIEW');
      
      vi.useRealTimers();
    });
  });

  describe('Resolve', () => {
    it('resolves an active incident', () => {
      sm.trigger('A', 'fire');
      sm.resolveIncident('A');
      expect(sm.getZoneState('A').phase).toBe('STANDBY');
    });

    it('clears playbook on resolve', () => {
      sm.trigger('A', 'fire');
      sm.requestCVConfirmation('A');
      sm.receiveCVResult({
        zoneId: 'A', confirmed: true, confidence: 0.9,
        detectionType: 'fire', signals: [], timestamp: Date.now(),
      });
      expect(sm.getPlaybook().length).toBeGreaterThan(0);

      sm.resolveIncident('A');
      const aPlaybook = sm.getPlaybook().filter(p => p.zone === 'A');
      expect(aPlaybook).toHaveLength(0);
    });
  });

  describe('Reset', () => {
    it('resets all state to defaults', () => {
      sm.trigger('A', 'fire');
      sm.trigger('B', 'explosion');
      sm.reset();

      const states = sm.getAllStates();
      for (const zone of ['A', 'B', 'C', 'D'] as const) {
        expect(states[zone].phase).toBe('STANDBY');
      }
      expect(sm.getRecentEvents()).toHaveLength(0);
      expect(sm.getPlaybook()).toHaveLength(0);
    });

    it('resets event ID counters (Fix #6)', () => {
      sm.trigger('A', 'fire');
      const firstEvent = sm.getRecentEvents()[0];
      expect(firstEvent.id).toBe('EVT-00001');

      sm.reset();
      sm.trigger('B', 'gas_leak');
      const secondEvent = sm.getRecentEvents()[0];
      expect(secondEvent.id).toBe('EVT-00001'); // counter resets
    });
  });

  describe('Playbook Actions', () => {
    it('generates playbook for confirmed incident', () => {
      sm.trigger('A', 'fire');
      sm.requestCVConfirmation('A');
      sm.receiveCVResult({
        zoneId: 'A', confirmed: true, confidence: 0.8,
        detectionType: 'fire', signals: [], timestamp: Date.now(),
      });
      const playbook = sm.getPlaybook();
      expect(playbook.length).toBe(5); // fire has 5 steps
      expect(playbook[0].zone).toBe('A');
      expect(playbook[0].completed).toBe(false);
    });

    it('completes a playbook action', () => {
      sm.trigger('A', 'fire');
      sm.requestCVConfirmation('A');
      sm.receiveCVResult({
        zoneId: 'A', confirmed: true, confidence: 0.8,
        detectionType: 'fire', signals: [], timestamp: Date.now(),
      });

      const actionId = sm.getPlaybook()[0].id;
      sm.completePlaybookAction(actionId);
      const action = sm.getPlaybook().find(a => a.id === actionId);
      expect(action?.completed).toBe(true);
    });
  });

  describe('Zone Queries', () => {
    it('getTriggeredZones returns only TRIGGERED zones', () => {
      sm.trigger('A', 'fire');
      sm.trigger('C', 'gas_leak');
      expect(sm.getTriggeredZones()).toContain('A');
      expect(sm.getTriggeredZones()).toContain('C');
      expect(sm.getTriggeredZones()).not.toContain('B');
    });

    it('getPinpointZones returns only PINPOINT zones', () => {
      sm.trigger('A', 'fire');
      sm.requestCVConfirmation('A');
      sm.receiveCVResult({
        zoneId: 'A', confirmed: true, confidence: 0.8,
        detectionType: 'fire', signals: [], timestamp: Date.now(),
      });
      expect(sm.getPinpointZones()).toContain('A');
      expect(sm.getPinpointZones()).not.toContain('B');
    });
  });
});
