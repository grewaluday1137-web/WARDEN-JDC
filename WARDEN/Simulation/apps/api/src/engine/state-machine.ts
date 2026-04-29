// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — 4-Stage Pinpoint State Machine
// Manages per-zone incident lifecycle: STANDBY → TRIGGERED → CONFIRMING → CONFIRMED → PINPOINT
// ═══════════════════════════════════════════════════════════════════════════════

import type { Zone, ZoneIncidentState, SystemPhase, IncidentType, CVAnalysisResult, SystemEvent, PlaybookAction } from '../types';

const CV_TIMEOUT_MS = 7000;

// ─── Playbook Templates ──────────────────────────────────────────────────────
const PLAYBOOK_TEMPLATES: Record<IncidentType, string[]> = {
  fire: [
    'Activate fire suppression system in zone',
    'Isolate HVAC ducts to prevent smoke spread',
    'Dispatch fire response team to zone',
    'Begin evacuation of adjacent zones',
    'Confirm all personnel accounted for via BLE',
  ],
  explosion: [
    'Initiate structural integrity assessment',
    'Activate blast containment protocols',
    'Dispatch medical and hazmat teams',
    'Evacuate all zones immediately',
    'Establish outer perimeter at safe distance',
  ],
  gas_leak: [
    'Shut off gas supply valves for zone',
    'Activate ventilation fans to max capacity',
    'Equip responders with gas masks',
    'Monitor adjacent zones for gas spread',
    'Confirm gas levels return to safe threshold',
  ],
  structural_collapse: [
    'Activate seismic dampeners if available',
    'Deploy search-and-rescue team to zone',
    'Halt all activity in adjacent zones',
    'Activate BLE scan for trapped personnel',
    'Request structural engineering assessment',
  ],
  medical_emergency: [
    'Dispatch on-site medical response team',
    'Clear access corridors for emergency services',
    'Activate AED/First Aid kit nearby',
    'Alert designated emergency contacts',
    'Maintain patient privacy and safety',
  ],
  security_breach: [
    'Initiate lockdown for breached zone',
    'Dispatch security personnel to intercept',
    'Review high-definition camera footage',
    'Verify identity of all individuals in zone',
    'Reset biometric access logs',
  ],
  active_shooter: [
    'Broadcast "RUN-HIDE-FIGHT" facility-wide',
    'Lock all external and internal doors',
    'Direct personnel to designated safe rooms',
    'Contact law enforcement with live footage',
    'Maintain absolute radio silence',
  ],
  power_outage: [
    'Verify status of backup generators',
    'Activate emergency egress lighting',
    'Halt all elevator activity and evacuations',
    'Prioritize power to life-safety systems',
    'Contact utility provider for ETA',
  ],
};

const RESOLVE_COOLDOWN_MS = 30_000; // 30 seconds

export class StateMachine {
  private zones = new Map<Zone, ZoneIncidentState>();
  private events: SystemEvent[] = [];
  private playbook: PlaybookAction[] = [];
  private cvPendingZones = new Set<Zone>();
  private resolveCooldowns = new Map<Zone, number>();
  private eventIdCounter = 0;
  private playbookIdCounter = 0;
  private externalAlertService?: any;

  private nextEventId() { return `EVT-F${this.floorId}-${String(++this.eventIdCounter).padStart(5, '0')}`; }
  private nextPlaybookId() { return `PB-F${this.floorId}-${String(++this.playbookIdCounter).padStart(4, '0')}`; }
  /** Tracks incident lifecycle cycles per zone to prevent stale CV responses */
  private zoneCycleIds = new Map<Zone, number>();
  private floorId: number = 1;
  private activeZoneIds: Zone[];

  constructor(floorId: number = 1, zoneIds?: Zone[]) {
    this.floorId = floorId;
    // If explicit zone IDs provided, use them; otherwise default to A-D
    this.activeZoneIds = zoneIds ?? ['A', 'B', 'C', 'D'];
    for (const z of this.activeZoneIds) {
      this.zones.set(z, this.defaultState(z));
    }
  }

  private defaultState(zone: Zone): ZoneIncidentState {
    return {
      zone,
      phase: 'STANDBY',
      incidentType: null,
      activeIncidents: [],
      triggeredAt: null,
      confirmedAt: null,
      bleActiveAt: null,
      cvRequestedAt: null,
      cvTimeoutMs: CV_TIMEOUT_MS,
      confidence: 0,
    };
  }

  /** Get all zone IDs managed by this state machine */
  getZoneIds(): Zone[] { return [...this.activeZoneIds]; }

  getZoneState(zone: Zone): ZoneIncidentState {
    return { ...(this.zones.get(zone) ?? this.defaultState(zone)) };
  }
  getAllStates(): Record<Zone, ZoneIncidentState> {
    const out: Partial<Record<Zone, ZoneIncidentState>> = {};
    for (const [z, s] of this.zones) out[z] = { ...s };
    return out as Record<Zone, ZoneIncidentState>;
  }
  getEvents(): SystemEvent[] { return [...this.events]; }
  getRecentEvents(count: number = 200): SystemEvent[] { return this.events.slice(-count); }
  getPlaybook(): PlaybookAction[] { return [...this.playbook]; }
  isCVPending(zone: Zone): boolean { return this.cvPendingZones.has(zone); }

  /** Push an event directly to the log (for external systems like auto-sim) */
  pushPublicEvent(zone: Zone | null, severity: SystemEvent['severity'], source: SystemEvent['source'], message: string, data?: Record<string, unknown>) {
    this.pushEvent(zone, severity, source, message, data);
  }

  setExternalAlertService(service: any) {
    this.externalAlertService = service;
  }

  // ─── Full Reset ─────────────────────────────────────────────────────────────
  reset(newZoneIds?: Zone[]) {
    if (newZoneIds) {
      this.activeZoneIds = [...newZoneIds];
    }
    
    this.zones.clear();
    for (const z of this.activeZoneIds) {
      this.zones.set(z, this.defaultState(z));
    }
    
    this.events = [];
    this.playbook = [];
    this.cvPendingZones.clear();
    this.resolveCooldowns.clear();
    this.eventIdCounter = 0;
    this.playbookIdCounter = 0;
    this.zoneCycleIds.clear();
    console.log(`[SM] Reset floor ${this.floorId} state machine (zones: ${this.activeZoneIds.join(',')})`);
  }

  // ─── Phase 2: TRIGGERED ─────────────────────────────────────────────────────
  trigger(zone: Zone, incidentType: IncidentType) {
    // Ensure zone exists in state machine — auto-add if missing
    if (!this.zones.has(zone)) {
      this.zones.set(zone, this.defaultState(zone));
      if (!this.activeZoneIds.includes(zone)) this.activeZoneIds.push(zone);
    }

    const state = this.zones.get(zone)!;

    // Check post-resolve cooldown
    const cooldownUntil = this.resolveCooldowns.get(zone);
    if (cooldownUntil && Date.now() < cooldownUntil) return;

    // If it's a new incident type for this zone, or we are in STANDBY, transition/update
    const isNewZoneTrigger = state.phase === 'STANDBY';
    const isNewIncidentType = !state.activeIncidents.includes(incidentType);

    if (isNewZoneTrigger) {
      state.phase = 'TRIGGERED';
      state.triggeredAt = Date.now();
      state.confidence = 0.4;
      
      // Increment cycle ID so stale CV responses are ignored
      const prevCycle = this.zoneCycleIds.get(zone) ?? 0;
      this.zoneCycleIds.set(zone, prevCycle + 1);
    }

    if (isNewIncidentType) {
      state.activeIncidents.push(incidentType);
      
      // Only push event for genuine transitions or new types
      this.pushEvent(zone, 'warning', 'sensor',
        `⚠️ ${incidentType.replace('_', ' ').toUpperCase()} detected at ${zone}`,
        { incidentType });
      
      console.log(`[SM] Triggered ${incidentType} in ${zone} (Phase: ${state.phase}, Total Active: ${state.activeIncidents.length})`);
    }
  }

  // ─── Phase 3: Request CV Confirmation ───────────────────────────────────────
  requestCVConfirmation(zone: Zone): boolean {
    const state = this.zones.get(zone);
    if (!state || state.phase !== 'TRIGGERED') return false;

    state.phase = 'CONFIRMING';
    state.cvRequestedAt = Date.now();
    this.cvPendingZones.add(zone);

    this.pushEvent(zone, 'info', 'state-machine',
      `📷 Requesting camera verification for ${zone} — analyzing ${state.incidentType}`);
    return true;
  }

  /** Get the current cycle ID for a zone (used to correlate CV responses) */
  getZoneCycleId(zone: Zone): number {
    return this.zoneCycleIds.get(zone) ?? 0;
  }

  // ─── Phase 3: Receive CV Result ─────────────────────────────────────────────
  receiveCVResult(result: CVAnalysisResult, expectedCycleId?: number) {
    const state = this.zones.get(result.zoneId);
    if (!state) return;
    this.cvPendingZones.delete(result.zoneId);

    // Guard: ignore stale CV responses from a previous incident cycle
    if (expectedCycleId !== undefined) {
      const currentCycle = this.zoneCycleIds.get(result.zoneId) ?? 0;
      if (expectedCycleId !== currentCycle) return;
    }

    if (state.phase !== 'CONFIRMING') return;

    if (result.confirmed && result.confidence >= 0.6) {
      // ── Phase 4: CONFIRMED → PINPOINT ──────────────────────────────────
      state.phase = 'CONFIRMED';
      state.confirmedAt = Date.now();
      state.confidence = result.confidence;

      this.pushEvent(result.zoneId, 'critical', 'cv-engine',
        `🔴 CONFIRMED: ${state.incidentType!.replace('_', ' ').toUpperCase()} in Zone ${result.zoneId} (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
        { incidentType: state.incidentType, confidence: result.confidence });

      // Generate playbook actions
      this.generatePlaybook(result.zoneId, state.incidentType!);

      // Immediately transition to PINPOINT
      state.phase = 'PINPOINT';
      state.bleActiveAt = Date.now();

      this.pushEvent(result.zoneId, 'critical', 'ble',
        `📡 BLE sweep ACTIVATED for Zone ${result.zoneId} — locating all personnel`,
        { incidentType: state.incidentType });
    } else {
      // Not confirmed, return to standby
      state.phase = 'STANDBY';
      state.confidence = result.confidence;
      this.pushEvent(result.zoneId, 'info', 'cv-engine',
        `✅ Camera check: no visual confirmation in Zone ${result.zoneId}. Returning to standby.`);
      this.resetZone(result.zoneId);
    }
  }

  // ─── CV Timeout Check ───────────────────────────────────────────────────────
  checkCVTimeouts(): Zone[] {
    const timedOut: Zone[] = [];
    const now = Date.now();

    for (const zone of this.cvPendingZones) {
      const state = this.zones.get(zone);
      if (!state) continue;
      if (state.cvRequestedAt && (now - state.cvRequestedAt) > state.cvTimeoutMs) {
        state.phase = 'MANUAL_REVIEW';
        this.cvPendingZones.delete(zone);
        timedOut.push(zone);

        this.pushEvent(zone, 'warning', 'state-machine',
          `⏱️ CV timeout in Zone ${zone} — escalating to MANUAL REVIEW`);
      }
    }
    return timedOut;
  }

  // ─── Operator Actions ───────────────────────────────────────────────────────
  resolveIncident(zone: Zone) {
    const state = this.zones.get(zone);
    if (!state || state.phase === 'STANDBY') return;

    this.pushEvent(zone, 'resolved', 'operator',
      `✅ Incident in Zone ${zone} resolved — cooldown active for 30s`);
    this.resetZone(zone);
    this.playbook = this.playbook.filter(a => a.zone !== zone);

    // Set 30-second cooldown to prevent immediate re-triggering
    this.resolveCooldowns.set(zone, Date.now() + RESOLVE_COOLDOWN_MS);
  }

  completePlaybookAction(actionId: string) {
    const action = this.playbook.find(a => a.id === actionId);
    if (action) {
      action.completed = true;
      this.pushEvent(action.zone, 'info', 'operator',
        `☑️ Playbook action completed: "${action.label}"`);
    }
  }

  // ─── Internals ──────────────────────────────────────────────────────────────
  private resetZone(zone: Zone) {
    this.zones.set(zone, this.defaultState(zone));
  }

  private pushEvent(zone: Zone | null, severity: SystemEvent['severity'], source: SystemEvent['source'], message: string, data?: Record<string, unknown>) {
    const event: SystemEvent = {
      id: this.nextEventId(),
      timestamp: Date.now(),
      zone,
      floor: this.floorId,
      severity,
      source,
      message,
      data,
    };
    this.events.push(event);

    // Forward to external organization API if critical/warning
    if (this.externalAlertService) {
      this.externalAlertService.sendAlert(event).catch(() => { });
    }

    // Keep max 500 events in memory
    if (this.events.length > 500) this.events = this.events.slice(-300);
  }

  private generatePlaybook(zone: Zone, incidentType: IncidentType) {
    // Remove any existing playbook for this zone
    this.playbook = this.playbook.filter(a => a.zone !== zone);

    const steps = PLAYBOOK_TEMPLATES[incidentType] ?? [];
    for (let i = 0; i < steps.length; i++) {
      this.playbook.push({
        id: this.nextPlaybookId(),
        incidentType,
        zone,
        step: i + 1,
        label: steps[i],
        completed: false,
        timestamp: Date.now(),
      });
    }
  }

  /** Get zones currently in PINPOINT phase (for BLE activation) */
  getPinpointZones(): Zone[] {
    const zones: Zone[] = [];
    for (const [z, s] of this.zones) {
      if (s.phase === 'PINPOINT') zones.push(z);
    }
    return zones;
  }

  /** Get zones currently TRIGGERED and not yet sent to CV */
  getTriggeredZones(): Zone[] {
    const zones: Zone[] = [];
    for (const [z, s] of this.zones) {
      if (s.phase === 'TRIGGERED') zones.push(z);
    }
    return zones;
  }
}
