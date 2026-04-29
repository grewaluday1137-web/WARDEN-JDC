import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { BroadcastModal } from './BroadcastModal';
import { useSocket } from '../hooks/useSocket';
import { useCrisisStore } from '../store/useCrisisStore';
import GemmaChat from './GemmaChat';

export const ActionBar: React.FC = () => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const { emitBroadcastMessage } = useSocket();
  const { currentFloor, setCurrentFloor } = useCrisisStore();

  const floors = [
    { id: 'F3_SECOND', label: 'F2' },
    { id: 'F2_FIRST', label: 'F1' },
    { id: 'F1_GROUND', label: 'GF' }
  ];

  const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  };

  return (
    <div className="glass-panel" style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      padding: '12px 24px',
      marginTop: '16px',
      borderLeft: '4px solid var(--secondary)'
    }}>
      {/* Left: Gemma Chat */}
      <div style={{ display: 'flex', alignItems: 'center', width: '320px', height: '36px', position: 'relative' }}>
        <GemmaChat />
      </div>

      {/* Middle: Floor Select */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '1px', marginRight: '8px' }}>
          Floor Select
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {floors.map(floor => (
            <button
              key={floor.id}
              onClick={() => setCurrentFloor(floor.id)}
              className="hud-font"
              style={{
                padding: '6px 20px',
                background: currentFloor === floor.id ? 'var(--secondary)' : 'rgba(255,255,255,0.05)',
                border: currentFloor === floor.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                color: currentFloor === floor.id ? 'var(--on-secondary)' : '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '12px',
                fontWeight: currentFloor === floor.id ? 'bold' : 'normal',
                boxShadow: currentFloor === floor.id ? '0 0 10px rgba(255, 64, 129, 0.3)' : 'none'
              }}
            >
              {floor.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Broadcast Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className="btn-primary" 
          style={{ ...btnStyle, background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', transform: hovered === 'broadcast' ? 'scale(1.02)' : 'scale(1)', boxShadow: hovered === 'broadcast' ? '0 0 10px rgba(0, 229, 255, 0.1)' : 'none' }}
          onMouseEnter={() => setHovered('broadcast')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => setIsBroadcastModalOpen(true)}
        >
          <Radio size={16} /> BROADCAST MESSAGE
        </button>
      </div>

      <BroadcastModal 
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        onSend={(target, message) => emitBroadcastMessage(target, message)}
      />
    </div>
  );
};
