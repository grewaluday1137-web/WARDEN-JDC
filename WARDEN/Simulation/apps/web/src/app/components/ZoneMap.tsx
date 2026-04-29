'use client';

import type { Zone, ZonePhysics, ZoneIncidentState, EstimatedPosition, Prediction, GraphState } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { GraphOverlay } from './GraphOverlay';

const getZoneColor = (zone: string) => {
  const colors: Record<string, string> = { 
    A: '#22d3ee', B: '#f59e0b', C: '#84cc16', D: '#a855f7',
    main: '#3b82f6', hazard: '#ef4444', public: '#10b981'
  };
  return colors[zone] || '#64748b';
};

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  STANDBY: { label: 'Standby', color: '#10b981' },
  TRIGGERED: { label: 'Triggered', color: '#f59e0b' },
  CONFIRMING: { label: 'Verifying...', color: '#3b82f6' },
  CONFIRMED: { label: 'CONFIRMED', color: '#ef4444' },
  PINPOINT: { label: 'BLE Active', color: '#ef4444' },
  MANUAL_REVIEW: { label: 'Manual Review', color: '#f97316' },
};

const ROLE_COLORS: Record<string, string> = {
  guest: '#60a5fa', staff: '#34d399', responder: '#f87171',
};

const INCIDENT_ICONS: Record<string, string> = {
  fire: '🔥', explosion: '💥', gas_leak: '☁️', structural_collapse: '🏚️',
  medical_emergency: '🚑', security_breach: '🔓', active_shooter: '🔫',
  power_outage: '🔌'
};

const INCIDENT_COLORS: Record<string, string> = {
  fire: '#ef4444', explosion: '#f59e0b', gas_leak: '#a855f7', structural_collapse: '#6366f1',
  medical_emergency: '#3b82f6', security_breach: '#f43f5e', active_shooter: '#ef4444',
  power_outage: '#f59e0b'
};

// Zone center positions (percentage)
const ZONE_CENTERS: Record<Zone, { x: number; y: number }> = {
  A: { x: 25, y: 25 }, B: { x: 75, y: 25 },
  C: { x: 25, y: 75 }, D: { x: 75, y: 75 },
};

export function ZoneMap({ physics, states, blePositions, bleActive, predictions, graphState, restrictedZone, currentFloor, floorEpicenters }: {
  physics: Record<string, ZonePhysics>;
  states: Record<string, ZoneIncidentState>;
  blePositions: EstimatedPosition[];
  bleActive: string[];
  predictions: Prediction[];
  graphState: GraphState | null;
  restrictedZone?: string;
  currentFloor: number;
  floorEpicenters?: Record<number, Record<Zone, string[]>>;
}) {
  // Dynamically discover zones for the current floor
  const zones = Object.keys(physics).sort();
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Helper to get center of a zone based on its nodes
  const getZoneCenter = (zoneId: string) => {
    if (ZONE_CENTERS[zoneId as any]) return ZONE_CENTERS[zoneId as any];
    
    // Fallback: Average position of nodes in this zone
    const zoneNodes = graphState?.nodes.filter(n => n.zoneId === zoneId && (n.floor === undefined || n.floor === currentFloor)) || [];
    if (zoneNodes.length > 0) {
      const avgX = zoneNodes.reduce((sum, n) => sum + n.x, 0) / zoneNodes.length;
      const avgY = zoneNodes.reduce((sum, n) => sum + n.y, 0) / zoneNodes.length;
      return { x: avgX, y: avgY };
    }
    return { x: 50, y: 50 }; // Ultimate fallback
  };

  // Group predictions by target zone for clustering
  const predictionsByZone = new Map<string, Prediction[]>();
  for (const p of predictions) {
    const existing = predictionsByZone.get(p.zone) ?? [];
    existing.push(p);
    predictionsByZone.set(p.zone, existing);
  }

  return (
    <div 
      className="zone-map" 
      style={{ 
        flex: 1, 
        backgroundImage: `url('/floor-${currentFloor}.png')`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >

      {/* Organic Node-based Crisis Visualization (Dark Opaque Style) */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <defs>
          <filter id="metaball-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
          </filter>
          <radialGradient id="crisis-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(200, 30, 10, 0.95)" />
            <stop offset="60%" stopColor="rgba(120, 10, 0, 0.7)" />
            <stop offset="100%" stopColor="rgba(40, 0, 0, 0)" />
          </radialGradient>
        </defs>

        {/* 1. Static Base Markers - All nodes visible as subtle dots, brighter in active zones */}
        <g>
          {graphState?.nodes.filter(n => n.floor === undefined || n.floor === currentFloor).map(node => {
            const isInCrisisZone = restrictedZone && node.parentZone === restrictedZone;
            const microZone = graphState.zones.find(z => z.id === node.zoneId);
            const hasRisk = microZone && microZone.riskLevel > 20;
            
            return (
              <circle
                key={`base-${node.id}`}
                cx={`${node.x}%`}
                cy={`${node.y}%`}
                r={isInCrisisZone && hasRisk ? 3 : 1.5}
                fill={isInCrisisZone && hasRisk ? 'rgba(255, 120, 50, 0.8)' : 'rgba(255, 255, 255, 0.35)'}
              />
            );
          })}
        </g>

        {/* Removed SVG Dark Background Blobs to keep map visible behind Pulse Animation */}

        {/* Removed SVG Active Crisis Blobs in favor of HTML Pulse Animation */}
      </svg>

      {/* HTML Overlays for Nodes (Interactive & Active Crisis Pulse) */}
      {graphState?.nodes.filter(n => n.floor === undefined || n.floor === currentFloor).map(node => {
        const microZone = graphState.zones.find(z => z.id === node.zoneId);
        if (!microZone) return null;

        const tempHeat = Math.min(1, Math.max(0, (microZone.sensorData.temperature - 22) / 80));
        const smokeHeat = Math.min(1, Math.max(0, microZone.sensorData.smoke / 100));
        const gasHeat = Math.min(1, Math.max(0, microZone.sensorData.gas / 200));
        const baseRisk = microZone.riskLevel / 100;
        const intensity = Math.max(tempHeat, smokeHeat, gasHeat, baseRisk);
        
        // Only active if intensity is high AND this node is one of the designated epicenters for its zone
        const zoneEpicenterIds = floorEpicenters?.[currentFloor]?.[node.parentZone as Zone];
        const isEpicenter = Array.isArray(zoneEpicenterIds) 
          ? zoneEpicenterIds.includes(node.id) 
          : node.id === zoneEpicenterIds;
          
        // Active if it is marked as an epicenter, even for non-physics events
        const zoneState = states[node.parentZone as Zone];
        const isActiveCrisis = isEpicenter && zoneState && zoneState.phase !== 'STANDBY';
        if (restrictedZone && node.parentZone !== restrictedZone) return null;

        const visualIntensity = Math.max(intensity, isEpicenter ? 0.6 : 0);
        const radius = isActiveCrisis ? (12 + (18 * visualIntensity)) : 10;
        const isSelected = selectedNodeId === node.id;

        return (
          <motion.div
            key={`node-ui-${node.id}`}
            onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
            initial={false}
            animate={{
              scale: isActiveCrisis ? [1, 1.05, 1] : 1,
            }}
            transition={{
              duration: 2,
              repeat: isActiveCrisis ? Infinity : 0,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: radius * 2,
              height: radius * 2,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: isSelected ? 100 : (isActiveCrisis ? 50 : 10),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto'
            }}
          >
            {/* Outer Pulse Rings */}
            <AnimatePresence>
              {isActiveCrisis && (
                <>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: `2px solid ${visualIntensity > 0.5 ? '#ef4444' : '#f59e0b'}`,
                      pointerEvents: 'none'
                    }}
                  />
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.4 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: visualIntensity > 0.5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      pointerEvents: 'none'
                    }}
                  />
                </>
              )}
            </AnimatePresence>

            {/* Inner Core */}
            <div style={{
              width: isSelected ? '14px' : '10px',
              height: isSelected ? '14px' : '10px',
              borderRadius: '50%',
              background: isActiveCrisis 
                ? (visualIntensity > 0.5 ? '#ef4444' : '#f59e0b') 
                : (isSelected ? '#3b82f6' : 'rgba(255,255,255,0.3)'),
              boxShadow: isActiveCrisis 
                ? `0 0 20px ${visualIntensity > 0.5 ? '#ef4444' : '#f59e0b'}` 
                : (isSelected ? '0 0 10px #3b82f6' : 'none'),
              border: '2px solid rgba(255,255,255,0.8)',
              transition: 'all 0.2s',
              zIndex: 2
            }} />

            {/* Crisis Label */}
            {isActiveCrisis && (
              <div style={{
                position: 'absolute',
                top: '-24px',
                whiteSpace: 'nowrap',
                background: intensity > 0.5 ? '#ef4444' : '#f59e0b',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
                letterSpacing: '0.5px'
              }}>
                CRISIS {Math.round(intensity * 100)}%
              </div>
            )}

            {/* Node Tooltip */}
            {(isSelected) && (
              <div style={{
                position: 'absolute',
                top: '100%',
                marginTop: '12px',
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 110,
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 700, marginBottom: '2px', textTransform: 'uppercase' }}>Node Configuration</div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{node.id}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ color: microZone.riskLevel > 50 ? '#ef4444' : '#10b981' }}>
                    Risk Index: {microZone.riskLevel}%
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)' }}>|</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)' }}>Zone {node.parentZone}</div>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Floating Zone Phase Labels (No zone coloring, just text) */}
      {zones.map(zone => {
        const st = states[zone];
        if (!st) return null;
        const isActive = st.phase !== 'STANDBY';
        const center = getZoneCenter(zone);

        return (
          <div key={`label-${zone}`} style={{
            position: 'absolute',
            left: `${center.x}%`,
            top: `${center.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 5,
            pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            opacity: 0.7,
          }}>
            {isActive && st.phase !== 'PINPOINT' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: 4,
                  background: `${PHASE_LABELS[st.phase]?.color || '#666'}20`,
                  color: PHASE_LABELS[st.phase]?.color || '#666',
                  letterSpacing: '0.5px',
                }}
              >
                {PHASE_LABELS[st.phase]?.label}
              </motion.div>
            )}
          </div>
        );
      })}

      {/* GraphOverlay is present in the codebase but hidden from UI/UX per request */}
      {/* <GraphOverlay graphState={graphState} /> */}

      {/* ═══ GHOST PREDICTION MARKERS ═══ */}
      <AnimatePresence>
        {zones.map(zone => {
          const zonePreds = predictionsByZone.get(zone);
          if (!zonePreds || zonePreds.length === 0) return null;

          const center = getZoneCenter(zone);
          const isExpanded = expandedPrediction === zone;

          return (
            <motion.div
              key={`ghost-${zone}`}
              className="ghost-marker-cluster"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.15 } }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: `${center.x}%`,
                top: `${center.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 30,
                cursor: 'pointer',
              }}
              onClick={() => setExpandedPrediction(isExpanded ? null : zone)}
            >
              {/* Clustered prediction icons */}
              <div className="ghost-marker">
                <div className="ghost-marker-icons">
                  {zonePreds.slice(0, 3).map((pred, i) => (
                    <div
                      key={pred.id}
                      className="ghost-icon"
                      style={{
                        borderColor: INCIDENT_COLORS[pred.incidentType] || '#666',
                        marginLeft: i > 0 ? -6 : 0,
                        zIndex: 3 - i,
                      }}
                    >
                      <span style={{ fontSize: 12 }}>{INCIDENT_ICONS[pred.incidentType] || '⚠️'}</span>
                    </div>
                  ))}
                  {zonePreds.length > 3 && (
                    <div className="ghost-icon ghost-icon-more"
                      style={{ marginLeft: -6, zIndex: 0 }}>
                      +{zonePreds.length - 3}
                    </div>
                  )}
                </div>

                {/* Confidence badge — show highest */}
                <div className="ghost-confidence-badge">
                  <AlertTriangle size={9} />
                  {(Math.max(...zonePreds.map(p => p.confidence)) * 100).toFixed(0)}%
                </div>

                {/* ETA label */}
                <div className="ghost-eta">
                  T-{Math.min(...zonePreds.map(p => p.eta))}s
                </div>
              </div>

              {/* Expanded reasoning tooltip */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    className="ghost-reasoning-panel"
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b' }}>
                        Prediction Intel — Zone {zone}
                      </span>
                      <X size={12} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpandedPrediction(null); }} />
                    </div>
                    {zonePreds.map(pred => (
                      <div key={pred.id} className="ghost-reasoning-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span>{INCIDENT_ICONS[pred.incidentType]}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: INCIDENT_COLORS[pred.incidentType] }}>
                            {pred.incidentType.replace('_', ' ').toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {(pred.confidence * 100).toFixed(0)}% — ETA {pred.eta}s
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4, paddingLeft: 22 }}>
                          {pred.reasoning}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* BLE person dots — Hidden from UI/UX per request */}
      {/* 
      {blePositions.map(person => (
        <motion.div
          key={person.id}
          className="ble-dot"
          style={{
            left: `${person.x}%`,
            top: `${person.y}%`,
            background: ROLE_COLORS[person.role] || '#60a5fa',
            color: ROLE_COLORS[person.role] || '#60a5fa',
            willChange: 'transform, left, top',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1, left: `${person.x}%`, top: `${person.y}%` }}
          transition={{ duration: 0.4 }}
          title={`${person.id} (${person.role})`}
        />
      ))}
      */}

      {/* Beacon markers */}
      {[
        { x: 0, y: 0 }, { x: 100, y: 0 },
        { x: 0, y: 100 }, { x: 100, y: 100 },
      ].map((b, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${b.x}%`, top: `${b.y}%`,
          transform: 'translate(-50%, -50%)',
          width: 6, height: 6,
          background: 'rgba(59, 130, 246, 0.5)',
          borderRadius: 2,
          border: '1px solid rgba(59, 130, 246, 0.8)',
          zIndex: 3,
        }} />
      ))}

      {/* BLE legend — Hidden from UI/UX per request */}
      {/* 
      {blePositions.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          display: 'flex', gap: 10, zIndex: 20,
          fontSize: 9, color: 'var(--text-muted)',
          background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 6,
        }}>
          {Object.entries(ROLE_COLORS).map(([role, color]) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              {role}
            </div>
          ))}
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            {blePositions.length} tracked
          </span>
        </div>
      )}
      */}

      {/* Prediction legend */}
      {predictions.length > 0 && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          display: 'flex', alignItems: 'center', gap: 6, zIndex: 20,
          fontSize: 9, color: '#f59e0b',
          background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 6,
          border: '1px dashed rgba(245, 158, 11, 0.4)',
        }}>
          <AlertTriangle size={10} />
          <span style={{ fontWeight: 600 }}>{predictions.length} predicted threat{predictions.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
