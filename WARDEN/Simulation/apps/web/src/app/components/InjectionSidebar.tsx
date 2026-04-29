import { useState, useMemo, useEffect } from 'react';
import { IncidentType, ALL_FLOORS, FloorId, GraphState, SimulationMode } from '@crisis/types';
import { startSimulation, stopSimulation } from '../store';
import { Play, Power, AlertTriangle, Layers } from 'lucide-react';

interface InjectionSidebarProps {
  onInject: (data: { zone: string; incidentType: IncidentType[]; floor: FloorId[] }) => void;
  graphState: GraphState | null;
  currentFloor: number;
  simulationMode: SimulationMode;
}

export function InjectionSidebar({ onInject, graphState, currentFloor, simulationMode }: InjectionSidebarProps) {
  const [selectedTypes, setSelectedTypes] = useState<IncidentType[]>([]);
  const [selectedFloors, setSelectedFloors] = useState<FloorId[]>([currentFloor as FloorId]);

  // Sync selected floor when the user changes the global map floor
  useEffect(() => {
    setSelectedFloors([currentFloor as FloorId]);
  }, [currentFloor]);

  const incidentOptions: { value: IncidentType; label: string; icon: string; category: string }[] = [
    { value: 'fire', label: 'Fire Outbreak', icon: '🔥', category: 'Physical' },
    { value: 'explosion', label: 'Explosion', icon: '💥', category: 'Physical' },
    { value: 'structural_collapse', label: 'Structural Failure', icon: '🏗️', category: 'Physical' },
    { value: 'gas_leak', label: 'Toxic Gas Leak', icon: '☣️', category: 'Environmental' },
    { value: 'medical_emergency', label: 'Medical Alert', icon: '🚑', category: 'Personnel' },
    { value: 'security_breach', label: 'Security Breach', icon: '🔓', category: 'Security' },
    { value: 'active_shooter', label: 'Hostile Behaviour', icon: '🔫', category: 'Security' },
    { value: 'power_outage', label: 'Power Grid Failure', icon: '🔌', category: 'Infrastructure' },
  ];

  const toggleType = (type: IncidentType) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleDeploy = () => {
    if (selectedTypes.length === 0) return;
    
    // Auto-switch to Floor 1 for Hostile Behaviour since the backend forces it
    if (selectedTypes.includes('active_shooter')) {
      import('../store').then(({ setCurrentFloor }) => setCurrentFloor(1));
    }

    onInject({
      zone: 'RANDOM', // Pick a random zone/node on the backend
      incidentType: selectedTypes,
      floor: selectedTypes.includes('active_shooter') ? [1] : selectedFloors,
    });
  };

  if (simulationMode === 'stopped') {
    return (
      <div style={{ 
        padding: '32px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        textAlign: 'center',
        gap: '24px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px'
        }}>
          <Power size={32} color="#3b82f6" />
        </div>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Simulation Standby</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            To begin a crisis exercise, initialize the simulation engine. You will then be able to configure and deploy custom incidents.
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => startSimulation('manual')}
          style={{ 
            width: '100%', 
            padding: '16px', 
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
        >
          <Play size={18} fill="currentColor" /> START SIMULATION
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-label" style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertTriangle size={12} /> Configure Crisis
        </div>
      </div>

      {/* Events — compact grid */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {incidentOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleType(opt.value)}
              className={`btn ${selectedTypes.includes(opt.value) ? 'active' : ''}`}
              style={{
                justifyContent: 'flex-start',
                padding: '14px 16px',
                background: selectedTypes.includes(opt.value) ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                borderColor: selectedTypes.includes(opt.value) ? 'var(--blue)' : 'rgba(255,255,255,0.1)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                fontSize: '11px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <span style={{ fontSize: '16px', marginRight: '8px' }}>{opt.icon}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: selectedTypes.includes(opt.value) ? '#fff' : 'var(--text-primary)' }}>{opt.label}</div>
              </div>
              {selectedTypes.includes(opt.value) && (
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: 'var(--blue)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Target Floors */}
        <div>
          <div className="section-label" style={{ marginBottom: '8px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={12} /> Target Floor
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {ALL_FLOORS.map(f => (
              <button
                key={f}
                onClick={() => {
                  setSelectedFloors([f]);
                  import('../store').then(({ setCurrentFloor }) => setCurrentFloor(f));
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: selectedFloors.includes(f) ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedFloors.includes(f) ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}`,
                  color: selectedFloors.includes(f) ? 'var(--cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {f === 1 ? 'GF' : `Floor : ${f - 1}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deploy */}
      <button
        onClick={handleDeploy}
        disabled={selectedTypes.length === 0}
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '16px',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '1px',
          borderRadius: '12px',
          boxShadow: selectedTypes.length > 0 ? '0 8px 24px -8px rgba(59, 130, 246, 0.5)' : 'none',
          opacity: selectedTypes.length === 0 ? 0.4 : 1,
          transform: selectedTypes.length > 0 ? 'translateY(0)' : 'translateY(2px)',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        DEPLOY CRISIS TO SITE
      </button>

      <button 
        onClick={() => stopSimulation()}
        style={{ width: '100%', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', marginTop: 'auto' }}
      >
        Reset System
      </button>
    </div>
  );
}
