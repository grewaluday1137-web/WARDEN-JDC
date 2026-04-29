// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — External Alert Dispatcher
// Forwards critical incidents to the Python-based organization backend.
// ═══════════════════════════════════════════════════════════════════════════════

import { SystemEvent, Zone } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'https://warden-backend-774533752332.us-central1.run.app';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InNpbS1pZC0wMDEiLCJ1c2VybmFtZSI6InNpbXVsYXRpb25fZW5naW5lIiwicm9sZSI6InN0YWZmIiwic3RhZmZfcm9sZSI6ImFkbWluIiwiZXhwIjoxNzg0MDE2Mjc1fQ.u-faHhqtOCJ9a8DnGhTYfsiYy8DmFaKCr-n16BSt-ZE';

// Load facility graph to determine specific node names per zone
let facilityNodes: any[] = [];
let facilityAnchors: Record<string, any> = {};
try {
  const graphPath = path.join(__dirname, '../../data/facility-graph.json');
  const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  facilityNodes = graphData.nodes || [];
  facilityAnchors = graphData.anchors || {};
} catch (e) {
  console.warn('[EXTERNAL] Could not load facility-graph.json for node name mapping');
}

function getNodeNameForZone(zone: string): string {
  const node = facilityNodes.find(n => n.id === zone);
  if (node) {
    return node.id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
  return `Zone ${zone} Node`;
}

function getLocationForZone(zone: string) {
  // Logic: Extract floor from zone ID if it exists (e.g., "F2_Lobby" -> Floor 2)
  const floorMatch = zone.match(/F(\d+)/i);
  const floor = floorMatch ? parseInt(floorMatch[1]) : 1;

  // Find area/room in graph
  const node = facilityNodes.find(n => n.id === zone);
  return {
    floor,
    room: node?.roomNumber || 100 + floor,
    area: node?.label || `Area ${zone}`
  };
}

export class ExternalAlertService {
  private failureCount = 0;
  private lastLoggedFailure = 0;
  /**
   * Dispatches an event to the external Python backend.
   * Maps SystemEvent into SensorAlert, CameraAlert, or GuestAlert structures.
   */
  public async sendAlert(event: SystemEvent) {
    if (!event.zone) return;

    // Only forward warning/critical events to avoid flooding the external API
    if (event.severity !== 'warning' && event.severity !== 'critical') return;

    const location = getLocationForZone(event.zone);
    const timestamp = event.timestamp / 1000; // Convert to float seconds for Python

    const nodeName = event.data?.nodeId 
      ? String(event.data.nodeId).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      : getNodeNameForZone(event.zone);

    // Uniform payload structure matching the Python backend's Pydantic models
    const payload = {
      source: this.mapSource(event.source),
      location: {
        floor: location.floor,
        room: location.room,
        area: location.area
      },
      metadata: {
        event_msg: event.message,
        node_name: nodeName,
        intensity: event.severity,
        incident_type: event.data?.incidentType || 'unknown'
      },
      timestamp: timestamp,
    };

    try {
      const response = await fetch(`${EXTERNAL_API_URL}/alert`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2000)
      });

      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }

      const result = await response.json();
      this.failureCount = 0; // Reset on success
      console.log(`[EXTERNAL] ✅ Alert accepted: ${result.message}`);
    } catch (err) {
      this.failureCount++;
      // Only log the first failure and every 60th failure to avoid log flooding
      if (this.failureCount === 1 || this.failureCount % 60 === 0) {
        console.warn(`[EXTERNAL] ⚠️ Alert dispatch unavailable (${this.failureCount} failures). Backend at ${EXTERNAL_API_URL} not reachable.`);
      }
    }
  }

  private mapSource(source: SystemEvent['source']): string {
    switch (source) {
      case 'sensor': return 'sensor';
      case 'cv-engine': return 'camera';
      case 'ble': return 'guest';
      default: return 'unknown';
    }
  }
}
