// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — After-Action Report Service
// Generates comprehensive post-simulation reports from session data,
// state machine history, fault logs, and evacuation metrics.
// Reports are persisted as local JSON files in data/reports/.
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  SimulationReport,
  SimulationSession,
  SessionTimelineEvent,
  EvacuationMetrics,
  IncidentType,
  Zone,
  PlaybookAction,
} from '../types';

const REPORTS_DIR = path.join(__dirname, '../../data/reports');

export interface ReportSummary {
  id: string;
  sessionId: string;
  generatedAt: string;
  tickCount: number;
  incidentCount: number;
  evacuated?: number;
}

export class ReportService {
  constructor() {
    this.ensureDir();
  }

  private ensureDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
  }

  // ─── Report Generation ──────────────────────────────────────────────────────

  generate(
    session: SimulationSession,
    playbook: PlaybookAction[],
    faultState: { activeFailures: { subsystem: string }[]; totalInjected: number; totalCleared: number },
    evacuationMetrics: EvacuationMetrics | null,
  ): SimulationReport {
    const timeline = session.timeline;

    // ── Incident summary ─────────────────────────────────────────────────
    const incidentTypes = new Set<IncidentType>();
    const affectedZones = new Set<Zone>();
    let confirmedCount = 0;
    let escalatedToManualReview = 0;

    for (const evt of timeline) {
      if (evt.type === 'incident_triggered' && evt.zone) {
        affectedZones.add(evt.zone);
        // Parse incident type from detail
        const iType = this.parseIncidentType(evt.detail);
        if (iType) incidentTypes.add(iType);
      }
      if (evt.type === 'incident_confirmed') confirmedCount++;
      if (evt.type === 'cv_result' && evt.detail.toLowerCase().includes('manual')) {
        escalatedToManualReview++;
      }
    }

    // Count manual_review from timeline events
    const manualReviewEvents = timeline.filter(e =>
      e.detail.toLowerCase().includes('manual_review') || e.detail.toLowerCase().includes('manual review')
    );
    escalatedToManualReview = Math.max(escalatedToManualReview, manualReviewEvents.length);

    // ── Prediction summary ───────────────────────────────────────────────
    const predictionEvents = timeline.filter(e => e.type === 'prediction_raised');
    const resolvedPreds = timeline.filter(e => e.type === 'prediction_cleared');
    let highestConfidence = 0;
    const topCascades: string[] = [];

    for (const evt of predictionEvents) {
      const confMatch = evt.detail.match(/(\d+)%/);
      if (confMatch) {
        const conf = parseInt(confMatch[1]) / 100;
        if (conf > highestConfidence) highestConfidence = conf;
      }
      if (topCascades.length < 5) {
        topCascades.push(evt.detail);
      }
    }

    // ── Failure summary ──────────────────────────────────────────────────
    const bySubsystem: Record<string, number> = {};
    const failureEvents = timeline.filter(e => e.type === 'failure_injected');
    for (const evt of failureEvents) {
      const subsystem = evt.detail.split(':')[0] || 'unknown';
      bySubsystem[subsystem] = (bySubsystem[subsystem] || 0) + 1;
    }

    // ── Operator/playbook summary ────────────────────────────────────────
    const completedSteps = playbook.filter(a => a.completed).length;
    const totalSteps = playbook.length;
    const unresolvedActions = totalSteps - completedSteps;

    // Time to first mitigation — first playbook completion event
    let timeToFirstMitigationTicks: number | null = null;
    const firstPlaybookComplete = timeline.find(e => e.type === 'playbook_completed');
    if (firstPlaybookComplete) {
      timeToFirstMitigationTicks = firstPlaybookComplete.tick;
    }

    // ── Outcome assessment ───────────────────────────────────────────────
    const strengths = this.assessStrengths(
      confirmedCount, completedSteps, totalSteps, evacuationMetrics, session.tickCount
    );
    const weaknesses = this.assessWeaknesses(
      escalatedToManualReview, unresolvedActions, evacuationMetrics, faultState
    );
    const suggestions = this.assessSuggestions(
      weaknesses, confirmedCount, evacuationMetrics, faultState
    );

    // ── Build report ─────────────────────────────────────────────────────
    const report: SimulationReport = {
      id: randomUUID(),
      sessionId: session.id,
      generatedAt: new Date().toISOString(),
      session,
      incidentSummary: {
        incidentTypes: [...incidentTypes],
        affectedZones: [...affectedZones],
        confirmedCount,
        escalatedToManualReview,
      },
      predictionSummary: {
        totalRaised: predictionEvents.length,
        highestConfidence,
        resolvedCount: resolvedPreds.length,
        unresolvedCount: predictionEvents.length - resolvedPreds.length,
        topCascades,
      },
      failureSummary: {
        totalInjected: faultState.totalInjected,
        bySubsystem,
        activeAtEnd: faultState.activeFailures.length,
      },
      operatorSummary: {
        playbookStepsCompleted: completedSteps,
        playbookStepsTotal: totalSteps,
        timeToFirstMitigationTicks,
        unresolvedActions,
      },
      evacuationSummary: evacuationMetrics ?? undefined,
      timeline,
      outcomeAssessment: {
        strengths,
        weaknesses,
        suggestions,
      },
    };

    // Persist report
    this.saveReport(report);
    console.log(`[REPORT] 📋 Generated report ${report.id.slice(0, 8)} for session ${session.id.slice(0, 8)}`);

    return report;
  }

  // ─── Assessment Logic ───────────────────────────────────────────────────────

  private assessStrengths(
    confirmedCount: number,
    completedSteps: number,
    totalSteps: number,
    evac: EvacuationMetrics | null,
    tickCount: number,
  ): string[] {
    const strengths: string[] = [];

    if (confirmedCount > 0) {
      strengths.push(`${confirmedCount} incident(s) were successfully confirmed through the 4-stage verification pipeline.`);
    }

    if (totalSteps > 0 && completedSteps / totalSteps >= 0.8) {
      strengths.push(`Strong playbook execution: ${completedSteps}/${totalSteps} steps completed (${Math.round(completedSteps / totalSteps * 100)}%).`);
    } else if (completedSteps > 0) {
      strengths.push(`${completedSteps} playbook step(s) were completed during the simulation.`);
    }

    if (evac) {
      if (evac.evacuatedCount > 0 && evac.trappedCount === 0) {
        strengths.push(`All ${evac.evacuatedCount} occupants were successfully evacuated with zero trapped.`);
      } else if (evac.evacuatedCount > 0) {
        strengths.push(`${evac.evacuatedCount} occupant(s) were evacuated during the scenario.`);
      }
      if (evac.responderArrivalTicks !== null && evac.responderArrivalTicks < 30) {
        strengths.push(`Rapid responder deployment: arrived in ${evac.responderArrivalTicks} ticks.`);
      }
    }

    if (tickCount > 0 && tickCount < 60) {
      strengths.push(`Quick resolution: simulation concluded in ${tickCount} ticks.`);
    }

    if (strengths.length === 0) {
      strengths.push('Simulation completed without catastrophic system failures.');
    }

    return strengths;
  }

  private assessWeaknesses(
    manualReview: number,
    unresolvedActions: number,
    evac: EvacuationMetrics | null,
    faultState: { activeFailures: { subsystem: string }[]; totalInjected: number },
  ): string[] {
    const weaknesses: string[] = [];

    if (manualReview > 0) {
      weaknesses.push(`${manualReview} incident(s) required manual review — CV confirmation failed or timed out.`);
    }

    if (unresolvedActions > 0) {
      weaknesses.push(`${unresolvedActions} playbook action(s) remained incomplete at simulation end.`);
    }

    if (evac && evac.trappedCount > 0) {
      weaknesses.push(`${evac.trappedCount} occupant(s) remained trapped during evacuation.`);
    }

    if (evac && evac.blockedExitImpacts > 0) {
      weaknesses.push(`Blocked exits impacted ${evac.blockedExitImpacts} routing decision(s).`);
    }

    if (faultState.activeFailures.length > 0) {
      weaknesses.push(`${faultState.activeFailures.length} fault(s) remained active at simulation end.`);
    }

    if (evac && evac.reroutes > 3) {
      weaknesses.push(`High reroute count (${evac.reroutes}) suggests exit congestion or changing hazard conditions.`);
    }

    return weaknesses;
  }

  private assessSuggestions(
    weaknesses: string[],
    confirmedCount: number,
    evac: EvacuationMetrics | null,
    faultState: { totalInjected: number },
  ): string[] {
    const suggestions: string[] = [];

    if (weaknesses.some(w => w.includes('manual review'))) {
      suggestions.push('Consider improving CV engine reliability or reducing confirmation timeout thresholds.');
    }

    if (weaknesses.some(w => w.includes('trapped'))) {
      suggestions.push('Review exit placement and capacity — ensure alternative routes are available for all zones.');
    }

    if (weaknesses.some(w => w.includes('playbook'))) {
      suggestions.push('Enhance operator training on playbook completion workflows.');
    }

    if (faultState.totalInjected === 0) {
      suggestions.push('Consider running fault injection scenarios to test system resilience.');
    }

    if (!evac) {
      suggestions.push('Consider running evacuation drills to validate occupant safety procedures.');
    }

    if (confirmedCount === 0) {
      suggestions.push('No confirmed incidents — consider running more aggressive simulation scenarios.');
    }

    if (suggestions.length === 0) {
      suggestions.push('Continue regular simulation drills to maintain operational readiness.');
    }

    return suggestions;
  }

  // ─── Utility ────────────────────────────────────────────────────────────────

  private parseIncidentType(detail: string): IncidentType | null {
    const lower = detail.toLowerCase();
    if (lower.includes('fire')) return 'fire';
    if (lower.includes('explosion')) return 'explosion';
    if (lower.includes('gas')) return 'gas_leak';
    if (lower.includes('structural') || lower.includes('collapse')) return 'structural_collapse';
    return null;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private saveReport(report: SimulationReport): void {
    this.ensureDir();
    const filePath = path.join(REPORTS_DIR, `${report.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }

  getReport(id: string): SimulationReport | null {
    const filePath = path.join(REPORTS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as SimulationReport;
    } catch {
      return null;
    }
  }

  listReports(): ReportSummary[] {
    this.ensureDir();
    const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json'));

    return files.map(f => {
      try {
        const raw = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8');
        const report = JSON.parse(raw) as SimulationReport;
        return {
          id: report.id,
          sessionId: report.sessionId,
          generatedAt: report.generatedAt,
          tickCount: report.session.tickCount,
          incidentCount: report.incidentSummary.confirmedCount,
          evacuated: report.evacuationSummary?.evacuatedCount,
        } as ReportSummary;
      } catch {
        return null;
      }
    }).filter((r): r is ReportSummary => r !== null)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  deleteReport(id: string): boolean {
    const filePath = path.join(REPORTS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }
}
