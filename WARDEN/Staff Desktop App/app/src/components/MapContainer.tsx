import React, { useState, useMemo } from 'react';
import { useCrisisStore, Person } from '../store/useCrisisStore';
import mapData from '../data/map.json';
import { TacticalPanel } from './TacticalPanel';

export const MapContainer: React.FC = () => {
  const { tickData, currentFloor, externalAlerts } = useCrisisStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (!tickData) return <div className="glass-panel" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Data</div>;

  // Extract the map data for the currently selected floor
  const floorData = (mapData.floors as any)[currentFloor];
  
  const mapImageSrc = currentFloor === 'F1_GROUND' ? '/Ground floor.png' :
                      currentFloor === 'F2_FIRST' ? '/First floor.png' :
                      '/Second floor.png';

  // Dynamic aspect ratio based on actual image dimensions to ensure node alignment
  const aspectRatio = useMemo(() => {
    switch(currentFloor) {
      case 'F1_GROUND': return 1672 / 941;
      case 'F2_FIRST': return 1644 / 913;
      case 'F3_SECOND': return 1657 / 861;
      default: return 16/9;
    }
  }, [currentFloor]);

  // Map floor ID (F1_GROUND) to a floor number (1) for matching with alerts
  const currentFloorNum = parseInt(currentFloor.replace(/[^0-9]/g, ''));

  return (
    <div className="map-container" style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      overflow: 'hidden', 
      borderRadius: '8px',
      backgroundColor: '#0a0b10'
    }}>
      {/* Wrapper that maintains image aspect ratio for perfect node alignment */}
      <div style={{ 
        position: 'relative', 
        aspectRatio: `${aspectRatio}`,
        maxWidth: '100%',
        maxHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img 
          src={mapImageSrc} 
          alt="Facility Map" 
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
        />
        <div className="map-dark-overlay" />
        
        <svg className="graph-layer" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.4 }}>
          {floorData?.edges.map((edge: any, idx: number) => {
            const s = (mapData.anchors as any)[edge.source];
            const t = (mapData.anchors as any)[edge.target];
            if (!s || !t) return null;
            return (
              <line key={`edge-${idx}`} x1={`${s.x}%`} y1={`${s.y}%`} x2={`${t.x}%`} y2={`${t.y}%`} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
            );
          })}
          {floorData?.nodes.map((node: any) => {
            const anchor = (mapData.anchors as any)[node.id];
            if (!anchor) return null;
            return <circle key={`node-svg-${node.id}`} cx={`${anchor.x}%`} cy={`${anchor.y}%`} r="1.5" fill={selectedNodeId === node.id ? "var(--primary)" : "rgba(255,255,255,0.4)"} />
          })}
        </svg>

        {floorData?.nodes.map((node: any) => {
          const anchor = (mapData.anchors as any)[node.id];
          if (!anchor) return null;

          const incident = tickData.incidents.find(inc => 
            Math.abs(inc.point.x - anchor.x) < 0.5 && 
            Math.abs(inc.point.y - anchor.y) < 0.5 && 
            (inc.floor === undefined || inc.floor === currentFloor)
          );

          // Check for external alerts matching this node
          const hasExternalAlert = externalAlerts.some(a => {
            const alertFloorNum = a.floor ? parseInt(a.floor.toString().replace(/[^0-9]/g, '')) : null;
            const floorMatches = alertFloorNum === null || alertFloorNum === currentFloorNum;
            const nodeMatches = a.node === node.id || a.zone === node.id || (a.message && a.message.includes(node.id));
            return floorMatches && nodeMatches;
          });

          const isActiveCrisis = !!incident || hasExternalAlert;
          const isSelected = selectedNodeId === node.id;
          
          return (
            <div
              key={`node-ui-${node.id}`}
              onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
              style={{
                position: 'absolute',
                left: `${anchor.x}%`,
                top: `${anchor.y}%`,
                width: isActiveCrisis ? '24px' : '16px',
                height: isActiveCrisis ? '24px' : '16px',
                marginLeft: isActiveCrisis ? '-12px' : '-8px',
                marginTop: isActiveCrisis ? '-12px' : '-8px',
                pointerEvents: 'auto',
                cursor: 'pointer',
                zIndex: isSelected ? 35 : (isActiveCrisis ? 25 : 20),
                backgroundColor: isSelected ? 'rgba(0, 212, 236, 0.3)' : 'transparent',
                border: isSelected ? '2px solid var(--primary)' : 'none',
                borderRadius: '50%',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isSelected ? '0 0 15px var(--primary)' : 'none'
              }}
            >
              {isActiveCrisis && (
                <div className="heartbeateffect" style={{ width: '100%', height: '100%' }} />
              )}
              
              {isSelected && (
                <div className="node-label">
                  {node.id.toUpperCase().replace(/_/g, ' ')}
                </div>
              )}
            </div>
          );
        })}

        {tickData.people
          .filter(p => p.floor === undefined || p.floor === currentFloor)
          .map((p: Person) => (
          <div key={p.id} className="person-marker" style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: p.role === 'staff' ? 'var(--secondary)' : p.role === 'responder' ? 'var(--primary)' : 'var(--warning)',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 8px currentColor',
            zIndex: 30,
            transition: 'all 0.3s ease'
          }} title={`${p.role} - ${p.zone}`} />
        ))}
      </div>

      <div className="map-vignette" />

      {selectedNodeId && (
        <TacticalPanel 
          nodeId={selectedNodeId} 
          onClose={() => setSelectedNodeId(null)} 
        />
      )}
    </div>
  );
};
