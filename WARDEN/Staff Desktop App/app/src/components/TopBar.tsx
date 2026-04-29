import React, { useState } from 'react';
import { GuestModal } from './GuestModal';
import { useCrisisStore } from '../store/useCrisisStore';

export const TopBar: React.FC = () => {
  const { systemStatus, mockMode } = useCrisisStore();
  const [guestOpen, setGuestOpen] = useState(false);

  const isCritical = systemStatus === 'Critical';

  return (
    <>
      <div className="glass-panel" style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '12px 24px',
        marginBottom: '16px',
        borderLeft: `4px solid ${isCritical ? 'var(--error)' : 'var(--primary)'}`,
        boxShadow: isCritical ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        {/* Left: Logo + WARDEN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <img 
            src="/Logo.png" 
            alt="Logo" 
            style={{ 
              height: '42px', 
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))'
            }} 
          />
          <h1 className="hud-font" style={{
            fontSize: '22px',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '3px',
            color: isCritical ? 'var(--error)' : 'var(--primary)',
            transition: 'color 0.3s ease',
            textShadow: isCritical ? '0 0 10px rgba(239,68,68,0.5)' : '0 0 10px rgba(59,130,246,0.3)',
          }}>
            WARDEN
          </h1>
        </div>

        {/* Middle: Status */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: '6px',
            backgroundColor: isCritical
              ? 'var(--error)'
              : systemStatus === 'Escalating'
                ? 'var(--warning)'
                : 'var(--safe)',
            color: systemStatus === 'Stable' ? '#fff' : isCritical ? '#fff' : 'var(--on-surface)',
            fontWeight: 'bold',
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            animation: isCritical ? 'critical-pulse 2s infinite' : 'none',
            boxShadow: isCritical ? '0 0 10px var(--error)' : 'none'
          }}>
            Status: {systemStatus}
          </div>
        </div>

        {/* Right: Live sync indicator + GUEST button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px', fontSize: '14px' }}>
          {mockMode ? (
            <span style={{ color: 'var(--warning)', fontWeight: 500 }}>MOCK MODE ACTIVE</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--safe)' }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--safe)',
                animation: 'pulse 1s infinite'
              }} />
              <span style={{ fontWeight: 600, letterSpacing: '0.5px', fontSize: '12px' }}>LIVE SYNC</span>
            </div>
          )}

          {/* GUEST button */}
          <button
            onClick={() => setGuestOpen(true)}
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              border: '1px solid rgba(99, 179, 237, 0.4)',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#93c5fd',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 12px rgba(59,130,246,0.15)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59, 130, 246, 0.25)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(59,130,246,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59, 130, 246, 0.12)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(59,130,246,0.15)';
            }}
          >
            GUEST
          </button>
        </div>
      </div>

      {guestOpen && <GuestModal onClose={() => setGuestOpen(false)} />}
    </>
  );
};
