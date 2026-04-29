'use client';

import type { CrisisStore } from '../store';
import { startSimulation, stopSimulation, setCurrentFloor } from '../store';
import { Shield, Play, Square } from 'lucide-react';

export function HeaderBar({ store }: { store: CrisisStore }) {
  const latestEvent = store.events[store.events.length - 1];

  return (
    <div className="header-bar">
      {/* Left: Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <Shield size={22} style={{ color: '#3b82f6' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>Crisis Simulation System</div>
        </div>
      </div>

      {/* Center: Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div className="status-badge" style={{
          color: store.connected ? '#10b981' : '#ef4444',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: store.connected ? '#10b981' : '#ef4444' }} />
          {store.connected ? 'Connected to server' : 'Offline'}
        </div>
        <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>T:{store.tick}</span>
          <span style={{ opacity: 0.3 }}>•</span>
          <span style={{ opacity: 0.7 }}>{store.lastTickTime ? new Date(store.lastTickTime).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
        </div>
        <div className="status-badge" style={{
          color: store.simulationMode !== 'stopped' ? '#3b82f6' : 'var(--text-muted)',
        }}>
          {store.simulationMode === 'stopped' ? 'Idle' : 'Active'}
        </div>


      </div>

      {/* Right: Status Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: store.simulationMode !== 'stopped' ? '#3b82f6' : '#64748b', boxShadow: store.simulationMode !== 'stopped' ? '0 0 10px #3b82f6' : 'none' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: store.simulationMode !== 'stopped' ? '#fff' : 'var(--text-muted)' }}>
            {store.simulationMode === 'stopped' ? 'SYSTEM STANDBY' : 'SIMULATION ACTIVE'}
          </span>
        </div>
      </div>

      {/* Error toast */}
      {store.error && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 200,
          padding: '10px 16px', borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#ef4444', fontSize: 13, fontWeight: 500,
          backdropFilter: 'blur(8px)', maxWidth: 360,
        }}>
          ⚠️ {store.error}
        </div>
      )}
    </div>
  );
}
