import { useState, useEffect } from 'react';
import './App.css';
import { useAlertSocket } from './hooks/useAlertSocket';
import { fetchAlerts } from './api';
import AlertCard from './components/AlertCard';
import DetailPanel from './components/DetailPanel';
import GemmaChat from './components/GemmaChat';
import logoImg from './assets/Logo.png';

export default function App() {
  const { connected, alerts: wsAlerts } = useAlertSocket();
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Bootstrap: load existing alerts via REST on mount ────────────────────
  useEffect(() => {
    fetchAlerts()
      .then((data) => {
        if (data.length) setAlerts(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Merge WebSocket alerts into local state ─────────────────────────────
  useEffect(() => {
    if (wsAlerts.length === 0) return;

    setAlerts((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      wsAlerts.forEach((a) => {
        const existing = map.get(a.id);
        map.set(a.id, existing ? { ...existing, ...a } : a);
      });
      return Array.from(map.values()).sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.timestamp - a.timestamp
      );
    });
  }, [wsAlerts]);

  const selectedAlert = alerts.find((a) => a.id === selectedId) || null;
  const activeCount = alerts.filter((a) => a.status !== 'resolved').length;

  return (
    <div className="app-shell">
      {/* ── Connection Banner ─────────────────────────────────────────────── */}
      {!connected && (
        <div className="connection-banner connection-banner--reconnecting">
          ⚠ RECONNECTING TO COMMAND CENTER…
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header__brand">
          <div className="header__logo">
            <img src={logoImg} alt="WARDEN Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }} />
          </div>
          <div>
            <div className="header__title">WARDEN</div>
            <div className="header__subtitle">First Responder Portal</div>
          </div>
        </div>

        <div className="header__status">
          <div
            className={`header__status-dot ${
              connected ? 'header__status-dot--connected' : 'header__status-dot--disconnected'
            }`}
          />
          <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </header>

      {/* ── Main Layout ───────────────────────────────────────────────────── */}
      <div className="main-content">
        {/* Left panel — alert list */}
        <aside className="alert-list-panel">
          <div className="alert-list-panel__header">
            <span className="alert-list-panel__title">Active Incidents</span>
            {activeCount > 0 && (
              <span className="alert-list-panel__count">{activeCount}</span>
            )}
          </div>

          <div className="alert-list-panel__body">
            {loading ? (
              <div className="detail-panel__empty" style={{ padding: '40px 0' }}>
                <div className="detail-panel__empty-icon" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>⏳</div>
                <div className="detail-panel__empty-text" style={{ fontSize: '13px' }}>
                  Loading incidents…
                </div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="detail-panel__empty" style={{ padding: '40px 0' }}>
                <div className="detail-panel__empty-icon">📡</div>
                <div className="detail-panel__empty-text" style={{ fontSize: '13px' }}>
                  Waiting for alerts…
                </div>
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  selected={selectedId === alert.id}
                  onClick={(a) => setSelectedId(a.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Right panel — detail view */}
        <DetailPanel alert={selectedAlert} allAlerts={alerts} setAlerts={setAlerts} />
      </div>

      <GemmaChat alerts={alerts} />
    </div>
  );
}
