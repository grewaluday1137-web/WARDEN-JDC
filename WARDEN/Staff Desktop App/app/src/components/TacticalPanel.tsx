import React from 'react';
import { useCrisisStore } from '../store/useCrisisStore';
import mapData from '../data/map.json';

interface TacticalPanelProps {
  nodeId: string;
  onClose: () => void;
}

export const TacticalPanel: React.FC<TacticalPanelProps> = ({ nodeId, onClose }) => {
  const { tickData } = useCrisisStore();

  if (!tickData) return null;

  // Find node details from mapData
  const zoneId = mapData.zones.find(z => z.nodes.includes(nodeId))?.id;
  const zoneData = zoneId ? tickData.zones[zoneId] : null;

  const incident = tickData.incidents.find(inc => 
    inc.zone === zoneId || (inc.point.x === (mapData.anchors as any)[nodeId]?.x && inc.point.y === (mapData.anchors as any)[nodeId]?.y)
  );

  return (
    <div className="tactical-panel glass-panel primary-glow">
      <div className="panel-header">
        <div className="header-title">
          <span className="node-icon">⬢</span>
          <h3>{nodeId.toUpperCase().replace(/_/g, ' ')}</h3>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="panel-content">
        <div className="status-section">
          <div className="section-label">ENVIRONMENTAL TELEMETRY</div>
          <div className="telemetry-grid">
            <div className="telemetry-item">
              <span className="label">TEMP</span>
              <span className="value hud-font" style={{ color: (zoneData?.temperature || 0) > 50 ? 'var(--error)' : 'var(--safe)' }}>
                {zoneData?.temperature?.toFixed(1) || '22.0'}°C
              </span>
            </div>
            <div className="telemetry-item">
              <span className="label">SMOKE</span>
              <span className="value hud-font" style={{ color: (zoneData?.smoke || 0) > 20 ? 'var(--warning)' : 'var(--safe)' }}>
                {zoneData?.smoke?.toFixed(1) || '0.0'}%
              </span>
            </div>
            <div className="telemetry-item">
              <span className="label">GAS</span>
              <span className="value hud-font" style={{ color: (zoneData?.gas || 0) > 10 ? 'var(--error)' : 'var(--safe)' }}>
                {zoneData?.gas?.toFixed(1) || '0.0'} ppm
              </span>
            </div>
            <div className="telemetry-item">
              <span className="label">INTEGRITY</span>
              <span className="value hud-font" style={{ color: (zoneData?.structuralIntegrity || 100) < 80 ? 'var(--error)' : 'var(--safe)' }}>
                {zoneData?.structuralIntegrity?.toFixed(0) || '100'}%
              </span>
            </div>
          </div>
        </div>

        {incident && (
          <div className="incident-section">
            <div className="section-label">ACTIVE INCIDENT</div>
            <div className="incident-card">
              <div className={`severity-badge ${incident.severity}`}>
                {incident.severity.toUpperCase()}
              </div>
              <div className="incident-info">
                <div className="type">{incident.type}</div>
                <div className="phase">{incident.phase.toUpperCase()}</div>
              </div>
            </div>
          </div>
        )}

        <div className="actions-section">
          <div className="section-label">TACTICAL COMMANDS</div>
          <div className="action-buttons">
            <button className="action-btn">
              <span className="icon">🔒</span>
              LOCKDOWN ZONE
            </button>
            <button className="action-btn">
              <span className="icon">👨‍🚒</span>
              DISPATCH RESPONDER
            </button>
            <button className="action-btn">
              <span className="icon">📢</span>
              BROADCAST ALERT
            </button>
            <button className="action-btn warning">
              <span className="icon">⚠️</span>
              FORCE EVACUATION
            </button>
          </div>
        </div>
      </div>

      <div className="panel-footer">
        <div className="footer-status">
          <span className="blink-dot"></span>
          REAL-TIME LINK ACTIVE
        </div>
        <div className="node-id-tag">F1-Z{zoneId || '00'}-{nodeId.split('_').pop()}</div>
      </div>
    </div>
  );
};
