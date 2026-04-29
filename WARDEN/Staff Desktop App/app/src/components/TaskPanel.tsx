import React from 'react';
import { useCrisisStore } from '../store/useCrisisStore';
import { useSocket } from '../hooks/useSocket';

export const TaskPanel: React.FC = () => {
  const { tickData } = useCrisisStore();
  const { emitCompleteTask } = useSocket();

  if (!tickData) return null;

  return (
    <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', background: 'rgba(31, 38, 54, 0.8)' }}>
      <h2 style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--on-surface-variant)', borderBottom: '1px solid rgba(113, 117, 131, 0.1)', paddingBottom: '6px' }}>Assigned Tasks</h2>
      
      {tickData.tasks.length === 0 && <span style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>No active tasks.</span>}
      
      {tickData.tasks.map((task) => (
        <div key={task.id} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '10px 12px',
          backgroundColor: 'var(--surface)',
          borderRadius: '4px',
          opacity: task.completed ? 0.5 : 1,
          border: '1px solid rgba(113, 117, 131, 0.1)'
        }}>
          <input 
            type="checkbox" 
            checked={task.completed}
            onChange={() => emitCompleteTask(task.id)}
            style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: task.completed ? 'var(--on-surface-variant)' : 'var(--on-surface)' }}>
              [{task.step}] {task.label}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--on-surface-variant)', marginTop: '4px', textTransform: 'uppercase' }}>
              Status: <span style={{ color: !task.completed ? 'var(--primary)' : 'inherit' }}>{task.completed ? 'completed' : 'active'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
