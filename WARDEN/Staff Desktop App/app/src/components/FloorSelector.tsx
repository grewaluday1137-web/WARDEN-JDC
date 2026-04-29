import React from 'react';
import { useCrisisStore } from '../store/useCrisisStore';

export const FloorSelector: React.FC = () => {
  const { currentFloor, setCurrentFloor } = useCrisisStore();

  const floors = [
    { id: 'F3_SECOND', label: 'L2' },
    { id: 'F2_FIRST', label: 'L1' },
    { id: 'F1_GROUND', label: 'GF' }
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      background: 'rgba(0,0,0,0.7)',
      padding: '8px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)',
      zIndex: 100
    }}>
      <div style={{ fontSize: '10px', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', marginBottom: '4px' }}>
        Floor
      </div>
      {floors.map(floor => (
        <button
          key={floor.id}
          onClick={() => setCurrentFloor(floor.id)}
          style={{
            padding: '8px 16px',
            background: currentFloor === floor.id ? 'var(--primary)' : 'transparent',
            border: currentFloor === floor.id ? 'none' : '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontWeight: currentFloor === floor.id ? 'bold' : 'normal'
          }}
        >
          {floor.label}
        </button>
      ))}
    </div>
  );
};
