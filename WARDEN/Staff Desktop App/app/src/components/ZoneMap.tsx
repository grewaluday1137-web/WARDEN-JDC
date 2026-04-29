import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { GraphOverlay } from './GraphOverlay';

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  STANDBY: { label: 'Standby', color: '#10b981' },
  TRIGGERED: { label: 'Triggered', color: '#f59e0b' },
  CONFIRMING: { label: 'Verifying...', color: '#3b82f6' },
  CONFIRMED: { label: 'CONFIRMED', color: '#ef4444' },
  PINPOINT: { label: 'BLE Active', color: '#ef4444' },
  MANUAL_REVIEW: { label: 'Manual Review', color: '#f97316' },
};

const INCIDENT_ICONS: Record<string, string> = {
  fire: '🔥', explosion: '💥', gas_leak: '☁️', structural_collapse: '🏚️',
  medical_emergency: '🚑', security_breach: '🔓', active_shooter: '🔫',
  power_outage: '🔌'
};

export function ZoneMap({ states, blePositions, graphState, currentFloor, floorEpicenters }: any) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const floorImage = `/floor-${currentFloor}.png`;
  const zones = Object.keys(states);

  // Helper to normalize coordinates (handle 0-100 and 0-1000)
  const normalize = (val: number) => val > 100 ? val / 10 : val;

  return (
    <div className="relative h-full w-full bg-slate-950 overflow-hidden">
      {/* Background Map with High-Contrast Overlay */}
      <div 
        className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-all duration-1000"
        style={{ 
          backgroundImage: `url(${floorImage})`,
          filter: 'brightness(0.7) contrast(1.1) saturate(0.9)'
        }}
      />

      {/* Tactical Scanning Grid */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
        style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} 
      />

      {/* SVG Layer for Node Infrastructure */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <g opacity="0.4">
          {graphState?.nodes.filter((n: any) => n.floor === undefined || Number(n.floor) === currentFloor).map((node: any) => (
            <circle
              key={`infra-${node.id}`}
              cx={`${normalize(node.x)}%`}
              cy={`${normalize(node.y)}%`}
              r="1.2"
              fill="rgba(255, 255, 255, 0.4)"
            />
          ))}
        </g>
      </svg>

      {/* Interactive Tactical Nodes */}
      {graphState?.nodes.filter((n: any) => n.floor === undefined || Number(n.floor) === currentFloor).map((node: any) => {
        const microZone = graphState.zones?.find((z: any) => z.id === node.zoneId);
        const zoneState = states[node.parentZone];
        
        const floorData = floorEpicenters?.[currentFloor];
        const zoneEpicenterIds = floorData?.[node.parentZone];
        const isEpicenter = Array.isArray(zoneEpicenterIds) 
          ? zoneEpicenterIds.includes(node.id) 
          : node.id === zoneEpicenterIds;
          
        const isActiveCrisis = isEpicenter && zoneState && zoneState.phase !== 'STANDBY';
        const isSelected = selectedNodeId === node.id;
        
        const x = normalize(node.x);
        const y = normalize(node.y);

        return (
          <motion.div
            key={`tactical-node-${node.id}`}
            onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
            className="absolute flex items-center justify-center cursor-pointer z-20"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: 32, height: 32,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Active Crisis Pulse */}
            {isActiveCrisis && (
              <>
                <motion.div
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-full h-full rounded-full border-2 border-red shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                />
                <motion.div
                  initial={{ scale: 0.5, opacity: 0.4 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute w-full h-full rounded-full bg-red/20"
                />
                <div className="absolute -top-7 whitespace-nowrap bg-red text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-white/20 animate-bounce shadow-xl">
                  {INCIDENT_ICONS[zoneState.incidentType] || 'CRISIS'}
                </div>
              </>
            )}

            {/* Node Visual */}
            <div className={`rounded-full border-2 transition-all duration-300 ${
              isActiveCrisis 
                ? 'w-4 h-4 bg-red border-white shadow-[0_0_15px_#ef4444]' 
                : (isSelected ? 'w-4 h-4 bg-blue border-white shadow-[0_0_10px_#3b82f6]' : 'w-2 h-2 bg-white/20 border-white/10')
            }`} />

            {/* Selection Tooltip */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-white/10 rounded-lg p-3 text-[10px] shadow-2xl backdrop-blur-xl z-[100] min-w-[140px]"
                >
                  <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-1.5">
                    <MapPin size={10} className="text-blue" />
                    <span className="font-black text-white">{node.id}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted font-bold uppercase tracking-tighter">Zone:</span>
                      <span className="text-secondary font-black">{node.parentZone}</span>
                    </div>
                    {microZone && (
                      <div className="flex justify-between">
                        <span className="text-muted font-bold uppercase tracking-tighter">Risk Level:</span>
                        <span className={`font-black ${microZone.riskLevel > 50 ? 'text-red' : 'text-emerald'}`}>
                          {microZone.riskLevel}%
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Floating Phase Labels */}
      {zones.map((zone: string) => {
        const st = states[zone];
        if (!st || st.phase === 'STANDBY') return null;
        
        // Find center of zone
        const zoneNodes = graphState?.nodes.filter((n: any) => n.parentZone === zone && (n.floor === undefined || Number(n.floor) === currentFloor)) || [];
        if (zoneNodes.length === 0) return null;
        
        const avgX = normalize(zoneNodes.reduce((sum: number, n: any) => sum + n.x, 0) / zoneNodes.length);
        const avgY = normalize(zoneNodes.reduce((sum: number, n: any) => sum + n.y, 0) / zoneNodes.length);

        return (
          <motion.div
            key={`zone-label-${zone}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute z-30 pointer-events-none"
            style={{ left: `${avgX}%`, top: `${avgY}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div 
              className="px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-2xl border backdrop-blur-md"
              style={{ 
                background: `${PHASE_LABELS[st.phase]?.color}15`,
                color: PHASE_LABELS[st.phase]?.color,
                borderColor: `${PHASE_LABELS[st.phase]?.color}40`,
              }}
            >
              {PHASE_LABELS[st.phase]?.label}
            </div>
          </motion.div>
        );
      })}

      {/* Personnel Tracking */}
      {blePositions.map((person: any) => (
        <motion.div
          key={`ble-${person.id}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1, left: `${normalize(person.x)}%`, top: `${normalize(person.y)}%` }}
          className="absolute w-2.5 h-2.5 rounded-full border border-white/50 z-40 shadow-lg"
          style={{ 
            backgroundColor: person.role === 'responder' ? '#ef4444' : person.role === 'staff' ? '#10b981' : '#3b82f6',
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 10px ${person.role === 'responder' ? '#ef4444' : person.role === 'staff' ? '#10b981' : '#3b82f6'}`
          }}
        />
      ))}

      <GraphOverlay graphState={graphState} />
    </div>
  );
}
