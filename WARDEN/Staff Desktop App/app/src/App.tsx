import React from 'react';
import './App.css';
import { TopBar } from './components/TopBar';
import { MapContainer } from './components/MapContainer';
import { AlertsPanel } from './components/AlertsPanel';
import { PredictionsPanel } from './components/PredictionsPanel';
import { TaskPanel } from './components/TaskPanel';
import { ActionBar } from './components/ActionBar';
import { useSocket } from './hooks/useSocket';
import { useCrisisStore } from './store/useCrisisStore';
import { X } from 'lucide-react';
import { API_BASE_URL } from './config';


const App: React.FC = () => {
  useSocket(API_BASE_URL);
  const { systemStatus, activeToasts, removeToast } = useCrisisStore();

  const isCritical = systemStatus === 'Critical';

  return (
    <>
      {isCritical && <div className="global-red-tint" />}
      
      {/* Toast Container */}
      <div className="toast-container">
        {activeToasts.map(toast => (
          <div key={toast.id} className="toast" style={{ borderLeftColor: toast.severity === 'critical' ? 'var(--error)' : 'var(--warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: toast.severity === 'critical' ? 'var(--error)' : 'var(--warning)' }}>
                {toast.severity} ALERT {toast.zone && `[ZONE ${toast.zone}]`}
              </span>
              <button 
                onClick={() => removeToast(toast.id)} 
                style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--on-surface)' }}>{toast.message}</div>
          </div>
        ))}
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh', 
        padding: '16px',
        gap: '16px',
        position: 'relative',
        zIndex: 1
      }}>
        <TopBar />
        
        
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          gap: '16px',
          overflow: 'hidden'
        }}>
          {/* Left Side: Map 75% */}
          <div style={{ flex: 7.5, display: 'flex', flexDirection: 'column' }}>
            <MapContainer />
            <ActionBar />
          </div>
          
          {/* Right Side: Panels 25% */}
          <div style={{ 
            flex: 2.5, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            overflow: 'hidden'
          }}>
            <AlertsPanel />
            <PredictionsPanel />
            <TaskPanel />
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
