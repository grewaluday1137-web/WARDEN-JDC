import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ReportService } from '../src/services/report-service';
import type {
  SimulationSession,
  SessionTimelineEvent,
  PlaybookAction,
  EvacuationMetrics,
} from '../../packages/types';

const REPORTS_DIR = path.join(__dirname, '../data/reports');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides?: Partial<SimulationSession>): SimulationSession {
  return {
    id: 'test-session-001',
    startedAt: '2026-04-12T10:00:00Z',
    endedAt: '2026-04-12T10:10:00Z',
    simulationMode: 'auto',
    tickCount: 120,
    timeline: [],
    ...overrides,
  };
}

function makeTimeline(...events: Partial<SessionTimelineEvent>[]): SessionTimelineEvent[] {
  return events.map((e, i) => ({
    tick: e.tick ?? i * 10,
    timestamp: Date.now(),
    type: e.type ?? 'incident_triggered',
    zone: e.zone,
    detail: e.detail ?? '',
    ...e,
  })) as SessionTimelineEvent[];
}

function makePlaybook(total: number, completed: number): PlaybookAction[] {
  const actions: PlaybookAction[] = [];
  for (let i = 0; i < total; i++) {
    actions.push({
      step: i + 1,
      action: `Step ${i + 1}`,
      completed: i < completed,
      completedAt: i < completed ? Date.now() : undefined,
    } as PlaybookAction);
  }
  return actions;
}

const DEFAULT_FAULT_STATE = {
  activeFailures: [] as { subsystem: string }[],
  totalInjected: 0,
  totalCleared: 0,
};

// ═══════════════════════════════════════════════════════════════════════════════

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(() => {
    service = new ReportService();
    // Clean reports directory
    if (fs.existsSync(REPORTS_DIR)) {
      for (const f of fs.readdirSync(REPORTS_DIR)) {
        if (f.startsWith('test-') || f.endsWith('.json')) {
          try { fs.unlinkSync(path.join(REPORTS_DIR, f)); } catch {}
        }
      }
    }
  });

  afterEach(() => {
    // Clean up created reports
    if (fs.existsSync(REPORTS_DIR)) {
      for (const f of fs.readdirSync(REPORTS_DIR)) {
        if (f.endsWith('.json')) {
          try { fs.unlinkSync(path.join(REPORTS_DIR, f)); } catch {}
        }
      }
    }
  });

  // ─── Generation ─────────────────────────────────────────────────────────────

  describe('generate', () => {
    it('creates a report with all required fields', () => {
      const session = makeSession();
      const report = service.generate(session, [], DEFAULT_FAULT_STATE, null);

      expect(report.id).toBeTruthy();
      expect(report.sessionId).toBe('test-session-001');
      expect(report.generatedAt).toBeTruthy();
      expect(report.session).toBe(session);
      expect(report.incidentSummary).toBeDefined();
      expect(report.predictionSummary).toBeDefined();
      expect(report.failureSummary).toBeDefined();
      expect(report.operatorSummary).toBeDefined();
      expect(report.outcomeAssessment).toBeDefined();
      expect(report.timeline).toBeDefined();
    });

    it('extracts incident types from timeline', () => {
      const timeline = makeTimeline(
        { type: 'incident_triggered', zone: 'A', detail: 'fire detected in Zone A' },
        { type: 'incident_triggered', zone: 'B', detail: 'gas_leak sensor triggered' },
        { type: 'incident_confirmed', zone: 'A', detail: 'fire confirmed' },
      );
      const session = makeSession({ timeline });
      const report = service.generate(session, [], DEFAULT_FAULT_STATE, null);

      expect(report.incidentSummary.incidentTypes).toContain('fire');
      expect(report.incidentSummary.incidentTypes).toContain('gas_leak');
      expect(report.incidentSummary.affectedZones).toContain('A');
      expect(report.incidentSummary.affectedZones).toContain('B');
      expect(report.incidentSummary.confirmedCount).toBe(1);
    });

    it('counts predictions from timeline', () => {
      const timeline = makeTimeline(
        { type: 'prediction_raised', detail: 'Zone A fire (85%)' },
        { type: 'prediction_raised', detail: 'Zone B explosion (60%)' },
        { type: 'prediction_cleared', detail: 'Zone A resolved' },
      );
      const session = makeSession({ timeline });
      const report = service.generate(session, [], DEFAULT_FAULT_STATE, null);

      expect(report.predictionSummary.totalRaised).toBe(2);
      expect(report.predictionSummary.resolvedCount).toBe(1);
      expect(report.predictionSummary.unresolvedCount).toBe(1);
      expect(report.predictionSummary.highestConfidence).toBe(0.85);
    });

    it('tracks failure injections', () => {
      const timeline = makeTimeline(
        { type: 'failure_injected', detail: 'sensor:stuck — Zone A' },
        { type: 'failure_injected', detail: 'sensor:noise — Zone B' },
        { type: 'failure_injected', detail: 'cv:timeout — global' },
      );
      const session = makeSession({ timeline });
      const faultState = {
        activeFailures: [{ subsystem: 'sensor' }],
        totalInjected: 3,
        totalCleared: 2,
      };

      const report = service.generate(session, [], faultState, null);

      expect(report.failureSummary.totalInjected).toBe(3);
      expect(report.failureSummary.activeAtEnd).toBe(1);
      expect(report.failureSummary.bySubsystem['sensor']).toBe(2);
      expect(report.failureSummary.bySubsystem['cv']).toBe(1);
    });

    it('tracks operator playbook completion', () => {
      const playbook = makePlaybook(5, 3);
      const timeline = makeTimeline(
        { type: 'playbook_completed', tick: 25, detail: 'step completed' },
      );
      const session = makeSession({ timeline });
      const report = service.generate(session, playbook, DEFAULT_FAULT_STATE, null);

      expect(report.operatorSummary.playbookStepsCompleted).toBe(3);
      expect(report.operatorSummary.playbookStepsTotal).toBe(5);
      expect(report.operatorSummary.unresolvedActions).toBe(2);
      expect(report.operatorSummary.timeToFirstMitigationTicks).toBe(25);
    });

    it('includes evacuation summary when provided', () => {
      const evac: EvacuationMetrics = {
        totalOccupants: 20,
        evacuatedCount: 18,
        trappedCount: 2,
        movingCount: 0,
        avgEvacuationTimeTicks: 35,
        responderArrivalTicks: 12,
        highestRiskZone: 'A',
        reroutes: 4,
        blockedExitImpacts: 1,
      };
      const session = makeSession();
      const report = service.generate(session, [], DEFAULT_FAULT_STATE, evac);

      expect(report.evacuationSummary).toBeDefined();
      expect(report.evacuationSummary!.totalOccupants).toBe(20);
      expect(report.evacuationSummary!.evacuatedCount).toBe(18);
      expect(report.evacuationSummary!.trappedCount).toBe(2);
    });

    it('omits evacuation summary when null', () => {
      const report = service.generate(makeSession(), [], DEFAULT_FAULT_STATE, null);
      expect(report.evacuationSummary).toBeUndefined();
    });
  });

  // ─── Outcome Assessment ─────────────────────────────────────────────────────

  describe('outcomeAssessment', () => {
    it('identifies strengths for good performance', () => {
      const timeline = makeTimeline(
        { type: 'incident_confirmed', detail: 'fire confirmed' },
      );
      const playbook = makePlaybook(5, 5);
      const evac: EvacuationMetrics = {
        totalOccupants: 10, evacuatedCount: 10, trappedCount: 0,
        movingCount: 0, avgEvacuationTimeTicks: 20, responderArrivalTicks: 8,
        highestRiskZone: null, reroutes: 0, blockedExitImpacts: 0,
      };

      const report = service.generate(
        makeSession({ timeline, tickCount: 50 }),
        playbook, DEFAULT_FAULT_STATE, evac,
      );

      const { strengths } = report.outcomeAssessment;
      expect(strengths.length).toBeGreaterThan(0);
      // Should mention confirmed incidents
      expect(strengths.some(s => s.includes('confirmed'))).toBe(true);
      // Should mention perfect evacuation
      expect(strengths.some(s => s.includes('successfully evacuated'))).toBe(true);
      // Should mention rapid responder
      expect(strengths.some(s => s.includes('Rapid responder'))).toBe(true);
    });

    it('identifies weaknesses for poor performance', () => {
      const timeline = makeTimeline(
        { type: 'cv_result', detail: 'manual review required for Zone A' },
      );
      const playbook = makePlaybook(5, 1);
      const faultState = {
        activeFailures: [{ subsystem: 'sensor' }, { subsystem: 'cv' }],
        totalInjected: 5,
        totalCleared: 3,
      };
      const evac: EvacuationMetrics = {
        totalOccupants: 10, evacuatedCount: 5, trappedCount: 3,
        movingCount: 2, avgEvacuationTimeTicks: 60, responderArrivalTicks: 40,
        highestRiskZone: 'A', reroutes: 8, blockedExitImpacts: 2,
      };

      const report = service.generate(
        makeSession({ timeline }), playbook, faultState, evac,
      );

      const { weaknesses } = report.outcomeAssessment;
      expect(weaknesses.length).toBeGreaterThan(0);
      expect(weaknesses.some(w => w.includes('trapped'))).toBe(true);
      expect(weaknesses.some(w => w.includes('fault'))).toBe(true);
    });

    it('provides suggestions based on weaknesses', () => {
      const report = service.generate(
        makeSession(), [], DEFAULT_FAULT_STATE, null,
      );

      const { suggestions } = report.outcomeAssessment;
      expect(suggestions.length).toBeGreaterThan(0);
      // Should suggest evacuation drills when none was run
      expect(suggestions.some(s => s.includes('evacuation'))).toBe(true);
    });
  });

  // ─── Persistence ────────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('saves and retrieves report by ID', () => {
      const report = service.generate(makeSession(), [], DEFAULT_FAULT_STATE, null);
      const loaded = service.getReport(report.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(report.id);
      expect(loaded!.sessionId).toBe(report.sessionId);
    });

    it('returns null for unknown report ID', () => {
      expect(service.getReport('non-existent')).toBeNull();
    });

    it('lists all saved reports', () => {
      service.generate(makeSession({ id: 'sess-1' }), [], DEFAULT_FAULT_STATE, null);
      service.generate(makeSession({ id: 'sess-2' }), [], DEFAULT_FAULT_STATE, null);

      const list = service.listReports();
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it('deletes a report', () => {
      const report = service.generate(makeSession(), [], DEFAULT_FAULT_STATE, null);
      expect(service.deleteReport(report.id)).toBe(true);
      expect(service.getReport(report.id)).toBeNull();
    });

    it('returns false when deleting non-existent report', () => {
      expect(service.deleteReport('non-existent')).toBe(false);
    });
  });

  // ─── List summaries ─────────────────────────────────────────────────────────

  describe('listReports', () => {
    it('includes relevant summary fields', () => {
      const evac: EvacuationMetrics = {
        totalOccupants: 15, evacuatedCount: 12, trappedCount: 3,
        movingCount: 0, avgEvacuationTimeTicks: 25, responderArrivalTicks: 10,
        highestRiskZone: 'B', reroutes: 2, blockedExitImpacts: 0,
      };
      const timeline = makeTimeline(
        { type: 'incident_confirmed', detail: 'confirmed' },
        { type: 'incident_confirmed', detail: 'confirmed' },
      );
      service.generate(
        makeSession({ timeline, tickCount: 80 }),
        [], DEFAULT_FAULT_STATE, evac,
      );

      const list = service.listReports();
      expect(list.length).toBe(1);
      const summary = list[0];
      expect(summary.tickCount).toBe(80);
      expect(summary.incidentCount).toBe(2);
      expect(summary.evacuated).toBe(12);
    });
  });
});
