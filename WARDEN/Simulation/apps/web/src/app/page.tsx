'use client';

import { useState } from 'react';
import { useSocket, useCrisisStoreSelector } from './store';
import { AnimatePresence } from 'framer-motion';

// ─── Extracted Components ────────────────────────────────────────────────────
import { HeaderBar } from './components/HeaderBar';
import { ZoneMap } from './components/ZoneMap';
import { EventLog } from './components/PlaybookPanel';
import { InjectionSidebar } from './components/InjectionSidebar';
import { useAudioFeedback } from './hooks/useAudioFeedback';
import { IncidentType, FloorId } from '@crisis/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Main Dashboard — Mission Control Layout
// Layout: [Map (full center)] [Right Panel: Event Generator + Events]
// ═══════════════════════════════════════════════════════════════════════════════
export default function Page() {
  useSocket();
  const events = useCrisisStoreSelector(s => s.events);
  const [rightTab, setRightTab] = useState<'generator' | 'logs'>('generator');
  const store = useCrisisStoreSelector(s => s);
  const { initAudio } = useAudioFeedback(events);

  const handleInject = async (data: { zone: string; incidentType: IncidentType[]; floor: FloorId[] }) => {
    try {
      const response = await fetch('/api/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`Injection failed with status ${response.status}:`, text);
        return;
      }
      
      const result = await response.json();
      if (!result.success) {
        console.error('Injection failed:', result.error);
      } else {
        setRightTab('logs'); // Switch to Events tab to show the new alert
      }
    } catch (err) {
      console.error('Network error during injection:', err);
    }
  };

  return (
    <div className="mission-control" onClickCapture={initAudio}>
      {/* ── Header ─── */}
      <HeaderBar store={store} />

      {/* ── Left Panel: Full-size Tactical Map ─── */}
      <div className="map-container">
        <ZoneMap
          physics={store.zonePhysics}
          states={store.zoneStates}
          blePositions={[
            ...store.blePositions,
            ...(store.evacuationAgents || [])
              .filter(a => a.status === 'moving' || a.status === 'idle')
              .map(a => ({ 
                id: a.id + '-evac', 
                role: a.role, 
                x: a.x, 
                y: a.y, 
                zone: a.currentZone, 
                floor: (a as any).floor,
                timestamp: Date.now() 
              }))
          ].filter(p => p.floor === undefined || p.floor === store.currentFloor)}
          bleActive={store.bleActive}
          predictions={store.predictions.filter(p => p.floor === undefined || p.floor === store.currentFloor)}
          graphState={store.graphState}
          restrictedZone={store.restrictedZone}
          currentFloor={store.currentFloor}
          floorEpicenters={store.floorEpicenters}
        />
      </div>

      {/* ── Right Panel: Switchable Generator & Logs ─── */}
      <div className="panel diagnostic-panel glass-card">
        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 8, margin: '16px' }}>
          <button 
            className={`btn ${rightTab === 'generator' ? 'active' : ''}`}
            style={{ flex: 1, border: 'none', background: rightTab === 'generator' ? 'rgba(56, 189, 248, 0.15)' : 'transparent' }}
            onClick={() => setRightTab('generator')}
          >
            Event Injection
          </button>
          <button 
            className={`btn ${rightTab === 'logs' ? 'active' : ''}`}
            style={{ flex: 1, border: 'none', background: rightTab === 'logs' ? 'rgba(56, 189, 248, 0.15)' : 'transparent' }}
            onClick={() => setRightTab('logs')}
          >
            Events
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {rightTab === 'generator' ? (
            <InjectionSidebar 
              onInject={handleInject} 
              graphState={store.graphState}
              currentFloor={store.currentFloor}
              simulationMode={store.simulationMode}
            />
          ) : (
            <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <EventLog events={store.events} />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
