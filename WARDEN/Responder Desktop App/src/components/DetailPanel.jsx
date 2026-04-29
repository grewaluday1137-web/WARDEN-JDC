import { useState, useEffect } from 'react';
import { getSeverity, timeAgo, formatLocation } from '../utils';
import { fetchReport, updateStatus } from '../api';
import FloorMap from './FloorMap';
import ResponderRoster from './ResponderRoster';
import { useSimulationSocket } from '../hooks/useSimulationSocket';

export default function DetailPanel({ alert, allAlerts = [], setAlerts }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  
  // Connect to Simulation Engine for live telemetry
  const { simulationData } = useSimulationSocket();
  const livePeople = simulationData?.people || [];

  // Auto-generate intelligence on alert change
  useEffect(() => {
    if (alert && !alert.ai_summary && !alert.detailed_report && !isGenerating) {
      handleGenerateIntelligence();
    }
  }, [alert?.id]);

  // WARDEN Intelligence generation
  const handleGenerateIntelligence = async () => {
    if (!alert || isGenerating) return;
    setIsGenerating(true);
    try {
      const { analyzeAlertsLocally } = await import('../services/localAiService.js');
      await analyzeAlertsLocally([alert], setAlerts);
    } catch (error) {
      console.error('Failed to generate intelligence:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Status handler ───────────────────────────────────────────────────────
  const handleStatus = async (newStatus) => {
    if (statusUpdating || newStatus === alert.status) return;
    setStatusUpdating(true);
    try {
      await updateStatus(alert.id, newStatus);
    } catch {
      /* error handled silently — WebSocket will reflect eventual state */
    } finally {
      setStatusUpdating(false);
    }
  };

  // ── Empty state — show the full building map ─────────────────────────────
  if (!alert) {
    return (
      <div className="detail-panel detail-panel--flush">
        <FloorMap alert={null} allAlerts={allAlerts} defaultFloor={1} />
      </div>
    );
  }

  const score = alert.score ?? 50;
  const { label: severityLabel, tier } = getSeverity(score);
  const status = alert.status || 'pending';
  const media = alert.media_attachments || [];

  return (
    <div className="detail-panel" key={alert.id}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="detail-header">
        <div className="detail-header__top">
          <span className={`detail-header__badge detail-header__badge--${tier}`}>
            {severityLabel} · Score {score}
          </span>
          <span className={`alert-card__status-pill alert-card__status-pill--${status}`}>
            ● {status}
          </span>
        </div>

        <h1 className="detail-header__title">
          {alert.metadata?.event_msg || `${alert.source} Incident`}
        </h1>

        <div className="detail-header__meta">
          <span className="detail-header__meta-item">📍 {formatLocation(alert.location)}</span>
          <span className="detail-header__meta-item">⏱ {timeAgo(alert.timestamp)}</span>
          <span className="detail-header__meta-item">🔖 {alert.source}</span>
          {alert.metadata?.incident_type && (
            <span className="detail-header__meta-item">🔥 {alert.metadata.incident_type}</span>
          )}
        </div>
      </div>

      {/* ── Response Actions ─────────────────────────────────────────────── */}
      <div className="action-bar">
        <button
          className={`action-btn action-btn--responding ${status === 'responding' ? 'action-btn--active' : ''}`}
          onClick={() => handleStatus('responding')}
          disabled={statusUpdating}
          id="btn-responding"
        >
          🚨 Responding
        </button>
        <button
          className={`action-btn action-btn--resolved ${status === 'resolved' ? 'action-btn--active' : ''}`}
          onClick={() => handleStatus('resolved')}
          disabled={statusUpdating}
          id="btn-resolved"
        >
          ✅ Resolved
        </button>
      </div>

      {/* ── Tactical Floor Map ────────────────────────────────────────────── */}
      <div className="section-card section-card--map">
        <div className="section-card__body section-card__body--flush">
          <FloorMap alert={alert} allAlerts={allAlerts} />
        </div>
      </div>

      {/* ── Live Responder Telemetry ─────────────────────────────────────── */}
      <ResponderRoster people={livePeople} />

      {/* ── WARDEN Intelligence ────────────────────────────────────────────── */}
      <div className="section-card ai-summary-card">
        <div className="section-card__header">
          <span className="section-card__header-icon">🧠</span>
          WARDEN Intelligence
        </div>
        <div className="section-card__body">
          {!alert.ai_summary && !alert.detailed_report && !isGenerating ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <button 
                className="action-btn action-btn--responding" 
                onClick={handleGenerateIntelligence}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>⚡</span> Generate Tactical Analysis
              </button>
            </div>
          ) : isGenerating && !alert.detailed_report ? (
            <div>
              <div className="shimmer shimmer--line" style={{ width: '100%' }}></div>
              <div className="shimmer shimmer--line" style={{ width: '95%' }}></div>
              <div className="shimmer shimmer--line" style={{ width: '80%' }}></div>
              <div className="shimmer shimmer--line" style={{ width: '85%' }}></div>
              <div className="shimmer shimmer--line" style={{ width: '60%' }}></div>
            </div>
          ) : (
            <div className="intelligence-content">
              {alert.ai_summary && (
                <div style={{ marginBottom: '16px' }}>
                  <strong>Summary:</strong>
                  <p style={{ marginTop: '8px', color: 'var(--text-primary)', fontSize: '15px' }}>{alert.ai_summary}</p>
                </div>
              )}
              {alert.detailed_report && (
                <div>
                  <strong>Tactical Report:</strong>
                  <div className="section-card__body--report" style={{ marginTop: '8px', whiteSpace: 'pre-wrap', padding: '0' }}>
                    {alert.detailed_report}
                    {isGenerating && <span className="streaming-cursor" style={{display: 'inline-block', width: '8px', height: '15px', background: 'var(--accent)', marginLeft: '4px', animation: 'pulse-glow 1s infinite'}}></span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Media Gallery ────────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card__header">
          <span className="section-card__header-icon">📸</span>
          Evidence &amp; Media ({media.length})
        </div>
        <div className="section-card__body">
          {media.length > 0 ? (
            <div className="media-gallery">
              {media.map((url, idx) => {
                const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
                return (
                  <div className="media-gallery__item" key={idx}>
                    {isVideo ? (
                      <video src={url} controls muted />
                    ) : (
                      <img src={url} alt={`Evidence ${idx + 1}`} loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="media-gallery__empty">
              No media attachments yet — images and video will appear here when captured by the CV Engine.
            </div>
          )}
        </div>
      </div>

      {/* ── Alert Metadata ───────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card__header">
          <span className="section-card__header-icon">🔧</span>
          Raw Metadata
        </div>
        <div className="section-card__body section-card__body--report" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
          {JSON.stringify(alert.metadata, null, 2)}
        </div>
      </div>
    </div>
  );
}
