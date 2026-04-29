'use client';

import React from 'react';

import type { Zone, ZoneIncidentState, SystemEvent, PlaybookAction, IncidentType, Prediction } from '../store';
import { completePlaybookAction } from '../store';
import { motion } from 'framer-motion';
import { Check, ShieldOff } from 'lucide-react';
import { GlassPanel } from './core/GlassPanel';

const ZONE_COLORS: Record<string, string> = { 
  A: '#22d3ee', B: '#f59e0b', C: '#84cc16', D: '#a855f7',
  lobby: '#22d3ee', reception: '#f59e0b', restaurant: '#84cc16', ballroom: '#a855f7', kitchen: '#ef4444'
};

const getZoneColor = (zone: string) => ZONE_COLORS[zone] || '#94a3b8';
const getZoneLabel = (zone: string) => {
  if (zone.length === 1) return `Zone ${zone}`;
  return zone.charAt(0).toUpperCase() + zone.slice(1).replace(/-/g, ' ');
};

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444', resolved: '#10b981',
};

// ─── Risk Reduction Map ──────────────────────────────────────────────────────
// Each playbook step type has a projected risk reduction percentage
const RISK_REDUCTION: Record<string, number> = {
  'Activate fire suppression system in zone': 40,
  'Isolate HVAC ducts to prevent smoke spread': 20,
  'Dispatch fire response team to zone': 15,
  'Begin evacuation of adjacent zones': 10,
  'Confirm all personnel accounted for via BLE': 5,
  'Initiate structural integrity assessment': 10,
  'Activate blast containment protocols': 35,
  'Dispatch medical and hazmat teams': 10,
  'Evacuate all zones immediately': 15,
  'Establish outer perimeter at safe distance': 5,
  'Shut off gas supply valves for zone': 45,
  'Activate ventilation fans to max capacity': 25,
  'Equip responders with gas masks': 5,
  'Monitor adjacent zones for gas spread': 10,
  'Confirm gas levels return to safe threshold': 10,
  'Activate seismic dampeners if available': 30,
  'Deploy search-and-rescue team to zone': 15,
  'Halt all activity in adjacent zones': 15,
  'Activate BLE scan for trapped personnel': 10,
  'Request structural engineering assessment': 10,
};

function getRiskReduction(label: string): number {
  return RISK_REDUCTION[label] ?? 10;
}

export function PlaybookPanel({ playbook, states, predictions }: {
  playbook: PlaybookAction[];
  states: Record<Zone, ZoneIncidentState>;
  predictions: Prediction[];
}) {
  // Count active predictions per zone
  const predCountByZone = new Map<Zone, number>();
  for (const p of predictions) {
    predCountByZone.set(p.zone, (predCountByZone.get(p.zone) ?? 0) + 1);
  }

  if (playbook.length === 0) {
    return (
      <GlassPanel style={{ padding: 16, textAlign: 'center' }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Action Playbook</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          No active incidents. Playbook actions appear here when a threat is confirmed.
        </div>
      </GlassPanel>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="section-label">Action Playbook</div>
      {playbook.map(action => {
        const reduction = getRiskReduction(action.label);
        const hasPredictions = (predCountByZone.get(action.zone) ?? 0) > 0;

        return (
          <motion.div
            key={action.id}
            className={`playbook-item ${action.completed ? 'completed' : ''}`}
            onClick={() => !action.completed && completePlaybookAction(action.id)}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="playbook-check">
              {action.completed && <Check size={12} style={{ color: 'white' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: action.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                {action.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: getZoneColor(action.zone) }}>{getZoneLabel(action.zone)}</span>
                <span>•</span>
                <span>Step {action.step}</span>
                {/* Risk Reduction Badge (v1.2) */}
                {action.completed && (
                  <span style={{ color: 'var(--emerald)', fontSize: 9, fontWeight: 600 }}>
                    ✓ Mitigated
                  </span>
                )}
                {/* Floor Marker */}
                <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>[F{action.zone.split('_')[0].replace('F', '')}]</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function EventLog({ events }: { events: SystemEvent[] }) {
  const reversed = [...events].reverse();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to top (latest event) whenever events change
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>System Events</span>
        {events.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, background: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa', padding: '2px 8px', borderRadius: 10, letterSpacing: '0.5px',
          }}>
            {events.length} events
          </span>
        )}
      </div>
      <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1 }}>
        {reversed.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
            No events yet. Start the simulation to see live events.
          </div>
        ) : (
          reversed.map(event => (
            <div key={event.id} className="event-item">
              <div className="event-severity-dot" style={{ background: SEVERITY_COLORS[event.severity] || '#666' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>{event.message}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }} className="font-mono">
                  <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  {event.floor && <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>[F{event.floor}]</span>}
                  {event.zone && <span style={{ color: getZoneColor(event.zone) }}>{getZoneLabel(event.zone)}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
