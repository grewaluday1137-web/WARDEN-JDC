// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Fault Manager
// Tracks active failure injections and provides fault-query API for engines.
// Each engine module checks FaultManager during its tick to apply fault effects.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Zone, FailureSubsystem, FailureMode, FailureInjection, FailureState,
} from '../types';
import { FailureInjectionSchema } from '../types';

let faultIdCounter = 0;
function nextFaultId(): string {
  return `FAULT-${String(++faultIdCounter).padStart(4, '0')}`;
}

export class FaultManager {
  private activeFaults: FailureInjection[] = [];
  private totalInjected = 0;
  private totalCleared = 0;

  // ─── Injection ──────────────────────────────────────────────────────────────

  /** Inject a new fault. Returns the created injection record. */
  inject(
    input: {
      subsystem: FailureSubsystem;
      mode: FailureMode;
      targetZone?: Zone;
      severity: number;
      durationTicks?: number;
      label?: string;
    },
    currentTick: number,
  ): FailureInjection {
    // Validate with Zod
    FailureInjectionSchema.parse(input);

    const fault: FailureInjection = {
      id: nextFaultId(),
      subsystem: input.subsystem,
      mode: input.mode,
      targetZone: input.targetZone,
      severity: Math.max(0, Math.min(1, input.severity)),
      durationTicks: input.durationTicks,
      startedAtTick: currentTick,
      label: input.label || `${input.subsystem}:${input.mode}`,
    };

    this.activeFaults.push(fault);
    this.totalInjected++;

    console.log(
      `[FAULT] 💉 Injected: ${fault.label} (${fault.subsystem}/${fault.mode})` +
      `${fault.targetZone ? ` in Zone ${fault.targetZone}` : ' globally'}` +
      ` severity=${fault.severity}` +
      `${fault.durationTicks ? ` for ${fault.durationTicks} ticks` : ' permanent'}`,
    );

    return fault;
  }

  // ─── Clearing ───────────────────────────────────────────────────────────────

  /** Clear a specific fault by ID */
  clear(faultId: string): boolean {
    const idx = this.activeFaults.findIndex(f => f.id === faultId);
    if (idx < 0) return false;

    const cleared = this.activeFaults.splice(idx, 1)[0];
    this.totalCleared++;
    console.log(`[FAULT] ✅ Cleared: ${cleared.label} (${cleared.id})`);
    return true;
  }

  /** Clear all faults */
  clearAll(): number {
    const count = this.activeFaults.length;
    this.totalCleared += count;
    this.activeFaults = [];
    if (count > 0) console.log(`[FAULT] 🧹 Cleared all ${count} active fault(s)`);
    return count;
  }

  /** Auto-expire faults that have exceeded their duration */
  tick(currentTick: number): void {
    const expired: FailureInjection[] = [];

    this.activeFaults = this.activeFaults.filter(f => {
      if (f.durationTicks == null) return true; // permanent
      if (currentTick - f.startedAtTick >= f.durationTicks) {
        expired.push(f);
        return false;
      }
      return true;
    });

    for (const f of expired) {
      this.totalCleared++;
      console.log(`[FAULT] ⏰ Expired: ${f.label} (${f.id}) after ${f.durationTicks} ticks`);
    }
  }

  // ─── Query API (used by engine modules) ─────────────────────────────────────

  /** Get all active faults */
  getActiveFaults(): FailureInjection[] {
    return [...this.activeFaults];
  }

  /** Get faults affecting a specific subsystem, optionally filtered by zone */
  getFaults(subsystem: FailureSubsystem, zone?: Zone): FailureInjection[] {
    return this.activeFaults.filter(f =>
      f.subsystem === subsystem &&
      (f.targetZone == null || f.targetZone === zone),
    );
  }

  /** Check if any fault of a specific mode is active for a subsystem + zone */
  hasFault(subsystem: FailureSubsystem, mode: FailureMode, zone?: Zone): boolean {
    return this.activeFaults.some(f =>
      f.subsystem === subsystem &&
      f.mode === mode &&
      (f.targetZone == null || f.targetZone === zone),
    );
  }

  /** Get the max severity of active faults for a subsystem + zone */
  getMaxSeverity(subsystem: FailureSubsystem, zone?: Zone): number {
    const faults = this.getFaults(subsystem, zone);
    if (faults.length === 0) return 0;
    return Math.max(...faults.map(f => f.severity));
  }

  /** Get current state snapshot */
  getState(): FailureState {
    return {
      activeFailures: [...this.activeFaults],
      totalInjected: this.totalInjected,
      totalCleared: this.totalCleared,
    };
  }

  /** Full reset */
  reset(): void {
    this.activeFaults = [];
    this.totalInjected = 0;
    this.totalCleared = 0;
    faultIdCounter = 0;
  }
}
