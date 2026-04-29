import React, { useEffect, useState } from 'react';
import { useCrisisStore } from '../store/useCrisisStore';
import { generateSystemInsights } from '../services/localAiService';

export const PredictionsPanel: React.FC = () => {
  const { tickData } = useCrisisStore();
  const [isGenerating, setIsGenerating] = useState(false);

  if (!tickData) return null;

  const lastSync = useCrisisStore(state => state.lastSyncTimestamp);

  // Auto-generate insights on data sync
  useEffect(() => {
    const totalAlerts = (tickData?.alerts.length || 0) + (useCrisisStore.getState().externalAlerts.length || 0);
    // Only auto-generate if we have data but no predictions yet
    if (totalAlerts > 0 && tickData && tickData.predictions.length === 0 && !isGenerating) {
      handleGenerate();
    }
  }, [lastSync]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await generateSystemInsights();
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', background: 'rgba(31, 38, 54, 0.6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(113, 117, 131, 0.1)', paddingBottom: '6px' }}>
        <h2 style={{ fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--primary)', margin: 0 }}>AI Predictions</h2>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: '#60a5fa',
            borderRadius: '4px',
            fontSize: '10px',
            padding: '2px 8px',
            cursor: isGenerating ? 'wait' : 'pointer',
            opacity: isGenerating ? 0.5 : 1
          }}>
          {isGenerating ? 'GENERATING...' : '⚡ WARDEN AI'}
        </button>
      </div>

      {tickData.predictions.length === 0 && <span style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>No active predictions.</span>}

      {tickData.predictions.map((pred) => (
        <div key={pred.id} style={{
          padding: '10px 12px',
          backgroundColor: 'var(--surface-container-highest)',
          border: '1px solid rgba(129, 236, 255, 0.05)',
          borderRadius: '4px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--secondary)' }}>{pred.zone} | {pred.incidentType}</span>
            <span style={{ fontSize: '11px', color: 'var(--primary)' }}>{(pred.confidence * 100).toFixed(0)}% CONF</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--on-surface)', marginBottom: '6px' }}>
            {pred.reasoning}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
            ETA: <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>{pred.eta}s</span>
          </div>
        </div>
      ))}
    </div>
  );
};
