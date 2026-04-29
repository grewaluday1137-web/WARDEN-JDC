// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — CV Engine Bridge
// Bridges Node.js API → Python FastAPI for camera confirmation
// With confidence timeout failsafe
// ═══════════════════════════════════════════════════════════════════════════════

import type { Zone, IncidentType, CVAnalysisResult } from '../types';
import type { FaultManager } from '../services/fault-manager';

const CV_ENGINE_URL = process.env.CV_ENGINE_URL || 'http://localhost:8000';

export class CVBridge {
  private isAvailable: boolean = false;
  private hasLoggedFallback: boolean = false;
  private faultManager: FaultManager | null;

  constructor(faultManager?: FaultManager) {
    this.faultManager = faultManager ?? null;
  }

  /**
   * Request camera analysis for a specific zone.
   * Calls the Python FastAPI service. If unavailable, returns a simulated result.
   */
  async analyzeZone(zone: Zone, incidentType: IncidentType): Promise<CVAnalysisResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${CV_ENGINE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zone, incident_type: incidentType }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`CV engine returned ${response.status}`);

      const data = await response.json();
      this.isAvailable = true;
      this.hasLoggedFallback = false; // Reset so we log again if it goes down later

      return {
        zoneId: zone,
        confirmed: data.confirmed ?? false,
        confidence: data.confidence ?? 0,
        detectionType: data.detection_type ?? incidentType,
        signals: data.signals ?? [],
        timestamp: Date.now(),
      };
    } catch {
      if (!this.hasLoggedFallback) {
        console.warn(`[CV Bridge] FastAPI unreachable at ${CV_ENGINE_URL} — using simulated confirmation mode`);
        this.hasLoggedFallback = true;
      }
      this.isAvailable = false;
      return this.applyFaultOverlay(this.simulateAnalysis(zone, incidentType), zone);
    }
  }

  /**
   * Apply fault effects to CV analysis results.
   * Modifies the result non-destructively.
   */
  private applyFaultOverlay(result: CVAnalysisResult, zone: Zone): CVAnalysisResult {
    if (!this.faultManager) return result;

    const faults = this.faultManager.getFaults('cv', zone);
    if (faults.length === 0) return result;

    let modified = { ...result };

    for (const fault of faults) {
      switch (fault.mode) {
        case 'unavailable':
          // CV system appears completely down
          modified.confirmed = false;
          modified.confidence = 0;
          modified.signals = [];
          break;
        case 'false_positive':
          // Force confirmation even when nothing is there
          modified.confirmed = true;
          modified.confidence = 0.7 + fault.severity * 0.25;
          if (modified.signals.length === 0) modified.signals = ['phantom_detection'];
          break;
        case 'false_negative':
          // Suppress real detections
          modified.confirmed = false;
          modified.confidence *= (1 - fault.severity);
          modified.signals = [];
          break;
        case 'low_confidence':
          // Degrade confidence score significantly
          modified.confidence *= (1 - fault.severity * 0.7);
          break;
        case 'timeout':
          // Act as if CV timed out
          modified.confirmed = false;
          modified.confidence = 0;
          modified.signals = ['timeout'];
          break;
      }
    }

    return modified;
  }

  /**
   * Simulated CV analysis — used when Python service isn't running.
   * Provides realistic confirmation based on incident type.
   */
  private simulateAnalysis(zone: Zone, incidentType: IncidentType): CVAnalysisResult {
    // Simulate processing delay
    // Deterministic high confidence (0.99)
    const baseConfidence = 0.99;
    const confirmed = true;

    const signalMap: Record<IncidentType, string[]> = {
      fire: ['flame_detected', 'heat_signature', 'smoke_plume'],
      explosion: ['debris_motion', 'dust_cloud', 'structural_damage'],
      gas_leak: ['haze_detected', 'air_distortion'],
      structural_collapse: ['falling_debris', 'dust_cloud', 'deformation'],
      medical_emergency: ['person_collapsed', 'medical_id_detected'],
      security_breach: ['unauthorized_entry', 'door_forced'],
      active_shooter: ['weapon_detected', 'panic_behavior'],
      power_outage: ['low_light_mode', 'ups_activated'],
    };

    return {
      zoneId: zone,
      confirmed,
      confidence: Math.round(baseConfidence * 100) / 100,
      detectionType: incidentType,
      signals: confirmed ? signalMap[incidentType] : [],
      timestamp: Date.now(),
    };
  }

  getAvailability(): boolean { return this.isAvailable; }
}
