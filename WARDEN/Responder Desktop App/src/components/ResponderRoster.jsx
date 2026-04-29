import React from 'react';

export default function ResponderRoster({ people }) {
  // Filter out only responders who have telemetry data
  const responders = (people || []).filter(p => p.role === 'responder' && p.telemetry);

  return (
    <div className="section-card">
      <div className="section-card__header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>
          <span className="section-card__header-icon">🫀</span>
          Responder Telemetry
        </span>
        <span className="alert-list-panel__count" style={{ marginLeft: '10px' }}>
          {responders.length} Active
        </span>
      </div>
      
      <div className="section-card__body section-card__body--flush">
        {responders.length === 0 ? (
          <div style={{ padding: '15px', color: '#64748b', fontSize: '13px' }}>
            No telemetry signals detected in this zone.
          </div>
        ) : (
          <div className="telemetry-list">
            {responders.map(r => {
              const isCritical = r.telemetry.isCritical;
              
              return (
                <div 
                  key={r.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid #1e293b',
                    backgroundColor: isCritical ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    animation: isCritical ? 'pulse 2s infinite' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: isCritical ? '#ef4444' : '#f8fafc', fontSize: '14px' }}>
                      {r.id}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      Zone {r.zone} {r.floor ? `· Floor ${r.floor}` : ''}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>HR</span>
                      <span style={{ 
                        fontWeight: 'bold', 
                        fontSize: '14px', 
                        color: r.telemetry.heartRate > 150 ? '#ef4444' : (r.telemetry.heartRate > 120 ? '#f59e0b' : '#22c55e')
                      }}>
                        {Math.round(r.telemetry.heartRate)} <span style={{fontSize: '10px', fontWeight: 'normal'}}>bpm</span>
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '50px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>O₂</span>
                      <span style={{ 
                        fontWeight: 'bold', 
                        fontSize: '14px', 
                        color: r.telemetry.oxygenLevel < 20 ? '#ef4444' : (r.telemetry.oxygenLevel < 50 ? '#f59e0b' : '#3b82f6')
                      }}>
                        {Math.round(r.telemetry.oxygenLevel)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
