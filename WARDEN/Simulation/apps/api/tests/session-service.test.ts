import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SessionService } from '../src/services/session-service';

const SESSIONS_DIR = path.join(__dirname, '../data/sessions');

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    service = new SessionService();
  });

  afterEach(() => {
    // Clean up any test sessions (only those created during this test run)
    if (service.isActive()) {
      service.endSession(0);
    }
  });

  describe('startSession', () => {
    it('creates a valid session', () => {
      const session = service.startSession('auto');
      expect(session.id).toBeTruthy();
      expect(session.startedAt).toBeTruthy();
      expect(session.simulationMode).toBe('auto');
      expect(session.tickCount).toBe(0);
      expect(session.timeline).toEqual([]);
    });

    it('sets isActive to true', () => {
      service.startSession('manual');
      expect(service.isActive()).toBe(true);
    });

    it('stores scenario name', () => {
      const session = service.startSession('auto', 'Fire Drill Alpha');
      expect(session.scenarioName).toBe('Fire Drill Alpha');
    });
  });

  describe('recordEvent', () => {
    it('appends event to timeline', () => {
      service.startSession('auto');
      service.recordEvent('incident_triggered', 'Fire in Zone A', 1, 'A');
      service.recordEvent('incident_confirmed', 'Fire confirmed', 5, 'A');

      const session = service.getCurrentSession();
      expect(session?.timeline.length).toBe(2);
      expect(session?.timeline[0].type).toBe('incident_triggered');
      expect(session?.timeline[0].tick).toBe(1);
      expect(session?.timeline[0].zone).toBe('A');
      expect(session?.timeline[1].type).toBe('incident_confirmed');
    });

    it('does nothing if no active session', () => {
      // Should not throw
      service.recordEvent('incident_triggered', 'Test', 1);
    });

    it('stores optional data payload', () => {
      service.startSession('auto');
      service.recordEvent('failure_injected', 'Sensor fault', 10, 'B', { mode: 'stuck_high', subsystem: 'sensor' });

      const event = service.getCurrentSession()?.timeline[0];
      expect(event?.data?.mode).toBe('stuck_high');
    });
  });

  describe('endSession', () => {
    it('persists session to disk', () => {
      const started = service.startSession('auto');
      service.recordEvent('incident_triggered', 'Test event', 1);
      const ended = service.endSession(42);

      expect(ended).toBeDefined();
      expect(ended!.endedAt).toBeTruthy();
      expect(ended!.tickCount).toBe(42);
      expect(ended!.timeline.length).toBe(1);

      // Verify file on disk
      const filePath = path.join(SESSIONS_DIR, `${started.id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      // Clean up
      fs.unlinkSync(filePath);
    });

    it('returns null if no active session', () => {
      const result = service.endSession(0);
      expect(result).toBeNull();
    });

    it('sets isActive to false', () => {
      service.startSession('auto');
      service.endSession(0);
      expect(service.isActive()).toBe(false);

      // Clean up the file
      const sessions = service.listSessions();
      if (sessions.length > 0) {
        service.deleteSession(sessions[0].id);
      }
    });
  });

  describe('getSession', () => {
    it('reads session from disk', () => {
      const started = service.startSession('manual');
      const id = started.id;
      service.recordEvent('incident_triggered', 'Test', 5, 'C');
      service.endSession(100);

      // Create new service instance to ensure no in-memory cache
      const service2 = new SessionService();
      const loaded = service2.getSession(id);

      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe(id);
      expect(loaded!.simulationMode).toBe('manual');
      expect(loaded!.tickCount).toBe(100);
      expect(loaded!.timeline.length).toBe(1);

      // Clean up
      service2.deleteSession(id);
    });

    it('returns null for non-existent session', () => {
      const result = service.getSession('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns current in-memory session if matching', () => {
      const started = service.startSession('auto');
      const result = service.getSession(started.id);
      expect(result).toBe(started); // Same reference
    });
  });

  describe('listSessions', () => {
    it('returns session summaries sorted by startedAt descending', async () => {
      // Create two sessions
      service.startSession('auto');
      service.recordEvent('incident_triggered', 'Event 1', 1);
      service.endSession(10);

      // Ensure distinct timestamps for sorting
      await new Promise(resolve => setTimeout(resolve, 10));

      service.startSession('manual');
      service.recordEvent('incident_triggered', 'Event 2', 1);
      service.endSession(20);

      const sessions = service.listSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);

      // Most recent first
      const latest = sessions[0];
      expect(latest.simulationMode).toBe('manual');
      expect(latest.tickCount).toBe(20);
      expect(latest.eventCount).toBe(1);

      // Clean up
      for (const s of sessions) {
        service.deleteSession(s.id);
      }
    });
  });

  describe('deleteSession', () => {
    it('removes session file', () => {
      service.startSession('auto');
      const session = service.endSession(5)!;
      expect(service.deleteSession(session.id)).toBe(true);
      expect(service.getSession(session.id)).toBeNull();
    });

    it('returns false for non-existent session', () => {
      expect(service.deleteSession('non-existent')).toBe(false);
    });
  });
});
