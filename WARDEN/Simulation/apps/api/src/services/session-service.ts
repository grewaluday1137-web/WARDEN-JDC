// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Simulation Session Service
// Tracks simulation run lifecycle, timeline events, and session persistence.
// Sessions are stored as local JSON files in data/sessions/.
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  SimulationSession,
  SessionTimelineEvent,
  SessionTimelineEventType,
  SimulationMode,
  Zone,
} from '../types';

const SESSIONS_DIR = path.join(__dirname, '../../data/sessions');
const MAX_TIMELINE_EVENTS = 10_000;

// ═══════════════════════════════════════════════════════════════════════════════

export interface SessionSummary {
  id: string;
  startedAt: string;
  endedAt?: string;
  simulationMode: SimulationMode;
  tickCount: number;
  eventCount: number;
  scenarioName?: string;
}

export class SessionService {
  private currentSession: SimulationSession | null = null;

  constructor() {
    this.ensureDir();
  }

  private ensureDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  // ── Session lifecycle ────────────────────────────────────────────────────────

  startSession(mode: SimulationMode, scenarioName?: string): SimulationSession {
    const session: SimulationSession = {
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      simulationMode: mode,
      tickCount: 0,
      timeline: [],
      scenarioName,
    };
    this.currentSession = session;
    console.log(`[SESSION] 📝 Started session ${session.id.slice(0, 8)} (mode: ${mode})`);
    return session;
  }

  endSession(tickCount: number): SimulationSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endedAt = new Date().toISOString();
    this.currentSession.tickCount = tickCount;

    // Persist to disk
    this.saveSessionToDisk(this.currentSession);

    const session = this.currentSession;
    console.log(`[SESSION] 💾 Ended session ${session.id.slice(0, 8)} (${session.timeline.length} events, ${tickCount} ticks)`);
    this.currentSession = null;
    return session;
  }

  isActive(): boolean {
    return this.currentSession !== null;
  }

  getCurrentSession(): SimulationSession | null {
    return this.currentSession;
  }

  getCurrentSessionId(): string | null {
    return this.currentSession?.id ?? null;
  }

  // ── Timeline event recording ────────────────────────────────────────────────

  recordEvent(
    type: SessionTimelineEventType,
    detail: string,
    tick: number,
    zone?: Zone,
    data?: Record<string, unknown>,
  ): void {
    if (!this.currentSession) return;

    const event: SessionTimelineEvent = {
      tick,
      timestamp: Date.now(),
      type,
      zone,
      detail,
      data,
    };

    this.currentSession.timeline.push(event);

    // Cap timeline to prevent unbounded growth
    if (this.currentSession.timeline.length > MAX_TIMELINE_EVENTS) {
      this.currentSession.timeline = this.currentSession.timeline.slice(-MAX_TIMELINE_EVENTS);
    }
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private saveSessionToDisk(session: SimulationSession): void {
    this.ensureDir();
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }

  getSession(id: string): SimulationSession | null {
    // Check if it's the current in-memory session
    if (this.currentSession?.id === id) return this.currentSession;

    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as SimulationSession;
    } catch (err: unknown) {
      console.error(`[SESSION] Failed to read session ${id}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  listSessions(): SessionSummary[] {
    this.ensureDir();
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));

    return files.map(f => {
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8');
        const session = JSON.parse(raw) as SimulationSession;
        return {
          id: session.id,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          simulationMode: session.simulationMode,
          tickCount: session.tickCount,
          eventCount: session.timeline.length,
          scenarioName: session.scenarioName,
        } as SessionSummary;
      } catch {
        return null;
      }
    }).filter((s): s is SessionSummary => s !== null)
      .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());
  }

  deleteSession(id: string): boolean {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }
}
