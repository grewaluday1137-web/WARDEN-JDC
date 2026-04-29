import React, { useState } from 'react';
import { useCrisisStore, Alert } from '../store/useCrisisStore';

const FLOOR_LABELS: Record<string, string> = {
  '1': 'Ground Floor',
  '2': 'Floor 1',
  '3': 'Floor 2',
  'F1_GROUND': 'Ground Floor',
  'F2_FIRST': 'Floor 1',
  'F3_SECOND': 'Floor 2',
};

const EVENT_COLORS: Record<string, string> = {
  fire: '#f97316',
  explosion: '#ef4444',
  gas_leak: '#eab308',
  active_shooter: '#dc2626',
  medical_emergency: '#3b82f6',
  security_breach: '#a855f7',
  structural_collapse: '#78716c',
  power_outage: '#6b7280',
};

function getEventColor(type?: string): string {
  if (!type) return 'var(--warning)';
  const key = type.toLowerCase().replace(/ /g, '_');
  return EVENT_COLORS[key] ?? 'var(--warning)';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'warning': return '#f59e0b';
    default: return '#3b82f6';
  }
}

function formatFloor(floor?: string | number): string | null {
  if (!floor) return null;
  return FLOOR_LABELS[String(floor)] ?? `Floor ${floor}`;
}

function formatNodeLabel(node?: string): string | null {
  if (!node) return null;
  // Convert F1_GROUND_N6 → Node N6 or "Lobby" — just pretty-print the ID
  return node.split('_').slice(-1)[0].replace('N', 'Node ');
}

export const AlertsPanel: React.FC = () => {
  const { externalAlerts } = useCrisisStore();
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Auto-generate analysis for new alerts
  React.useEffect(() => {
    const latestAlert = externalAlerts[0];
    if (latestAlert && !latestAlert.detailed_report && generatingId !== latestAlert.id) {
      handleGenerateAnalysis(latestAlert);
    }
  }, [externalAlerts?.[0]?.id]);

  const handleGenerateAnalysis = async (alert: Alert) => {
    setGeneratingId(alert.id);
    try {
      const { analyzeAlertsLocally } = await import('../services/localAiService');
      await analyzeAlertsLocally([alert]);
    } catch (error) {
      console.error('Failed to generate analysis:', error);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="glass-panel" style={{
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flex: 1,
      overflowY: 'auto',
      background: 'rgba(31, 38, 54, 0.4)',
    }}>
      <h2 style={{
        fontSize: '12px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: 'var(--on-surface-variant)',
        borderBottom: '1px solid rgba(113, 117, 131, 0.1)',
        paddingBottom: '6px',
        margin: 0,
      }}>
        Active Alerts
      </h2>

      {externalAlerts.length === 0 && (
        <span style={{ color: 'var(--safe)', fontSize: '11px' }}>No active alerts.</span>
      )}

      {externalAlerts.map((alert: Alert) => {
        const eventColor = getEventColor(alert.eventType);
        const severityColor = getSeverityColor(alert.severity);
        const floorLabel = formatFloor(alert.floor);
        const nodeLabel = formatNodeLabel(alert.node);

        return (
          <div key={alert.id} style={{
            padding: '10px 12px',
            backgroundColor: alert.severity === 'critical'
              ? 'rgba(239, 68, 68, 0.08)'
              : 'var(--surface-container-high)',
            borderLeft: `3px solid ${severityColor}`,
            borderRadius: '6px',
            boxShadow: alert.severity === 'critical'
              ? `0 2px 8px rgba(239,68,68,0.15)`
              : '0 2px 5px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}>

            {/* Top row: timestamp + event type badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
              {alert.eventType && (
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: eventColor,
                  background: `${eventColor}18`,
                  border: `1px solid ${eventColor}44`,
                  borderRadius: '4px',
                  padding: '2px 6px',
                }}>
                  {alert.eventType.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {/* Location row: floor + node */}
            {(floorLabel || nodeLabel) && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {floorLabel && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    color: '#60a5fa',
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                  }}>
                    📍 {floorLabel}
                  </span>
                )}
                {nodeLabel && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    color: 'var(--on-surface-variant)',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                  }}>
                    🔴 {nodeLabel}
                  </span>
                )}
              </div>
            )}

            {/* Message */}
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: alert.severity === 'critical' ? '#fff' : 'var(--on-surface)',
              lineHeight: 1.4,
            }}>
              {alert.message}
            </div>

            {/* WARDEN Intelligence Section */}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {!alert.detailed_report && generatingId !== alert.id ? (
                <button 
                  onClick={() => handleGenerateAnalysis(alert)}
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>⚡</span> Generate Tactical Analysis
                </button>
              ) : generatingId === alert.id && !alert.detailed_report ? (
                <div style={{ fontSize: '11px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>⚡</span> Analyzing...
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  <strong style={{ color: '#fff' }}>🧠 WARDEN Intelligence:</strong><br />
                  <div style={{ marginTop: '4px' }}>
                    {alert.detailed_report}
                    {generatingId === alert.id && <span style={{display: 'inline-block', width: '6px', height: '12px', background: '#60a5fa', marginLeft: '4px', animation: 'pulse-glow 1s infinite'}}></span>}
                  </div>
                </div>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
};
