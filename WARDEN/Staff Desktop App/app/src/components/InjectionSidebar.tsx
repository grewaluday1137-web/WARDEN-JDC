import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Power, AlertTriangle, Layers } from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';
import type { IncidentType, FloorId } from '../types';

export function InjectionSidebar() {
  const store = useCrisisStore();
  
  const floorMap: Record<string, FloorId> = {
    'F1_GROUND': 1,
    'F2_FIRST': 2,
    'F3_SECOND': 3
  };
  
  const currentFloorNum = floorMap[store.currentFloor] || 1;
  const [selectedTypes, setSelectedTypes] = useState<IncidentType[]>([]);
  const [selectedFloors, setSelectedFloors] = useState<FloorId[]>([currentFloorNum]);

  useEffect(() => {
    setSelectedFloors([currentFloorNum]);
  }, [store.currentFloor]);

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

  const handleStart = async () => {
    try {
      await fetch('http://localhost:8000/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'manual' }),
      });
    } catch (err) {
      console.error('Failed to start simulation:', err);
    }
  };

  const handleStop = async () => {
    try {
      await fetch('http://localhost:8000/api/simulation/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop simulation:', err);
    }
  };

  const handleDeploy = async () => {
    if (selectedTypes.length === 0) return;
    
    // Auto-switch to Floor 1 for Hostile Behaviour
    if (selectedTypes.includes('active_shooter')) {
      store.setCurrentFloor('F1_GROUND');
    }

    try {
      await fetch('http://localhost:8000/api/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone: 'RANDOM',
          incidentType: selectedTypes,
          floor: selectedTypes.includes('active_shooter') ? [1] : selectedFloors,
        }),
      });
    } catch (err) {
      console.error('Failed to inject incident:', err);
    }
  };

  const simMode = store.tickData?.simulationMode || 'stopped';

  if (simMode === 'stopped') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-20 h-20 rounded-2xl bg-blue/5 flex items-center justify-center border border-blue/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]"
        >
          <Power size={32} className="text-blue" />
        </motion.div>
        <div>
          <h3 className="text-sm font-black text-white mb-2 uppercase tracking-tighter">System Offline</h3>
          <p className="text-[10px] text-muted leading-relaxed max-w-[200px] mx-auto font-medium">
            Tactical simulation engine is in standby. Initialize to activate real-time site monitoring and crisis injection.
          </p>
        </div>
        <button 
          className="w-full py-4 rounded-xl bg-blue text-white flex items-center justify-center gap-3 font-black text-[11px] tracking-[1px] shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)] hover:shadow-[0_8px_25px_-4px_rgba(59,130,246,0.6)] active:translate-y-0.5 transition-all"
          onClick={handleStart}
        >
          <Play size={16} fill="currentColor" /> INITIALIZE SITE
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-[10px] text-muted font-black uppercase tracking-widest">
          <AlertTriangle size={12} className="text-amber" /> Configure Crisis
        </div>
        <button 
          onClick={handleStop}
          className="text-[10px] font-black text-red uppercase tracking-widest hover:opacity-80 transition-opacity"
        >
          Reset System
        </button>
      </div>

      {/* Incident Options Grid */}
      <div className="grid grid-cols-2 gap-2">
        {incidentOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => toggleType(opt.value)}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all duration-200 relative overflow-hidden ${
              selectedTypes.includes(opt.value) 
                ? 'bg-blue/10 border-blue shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            <span className="text-lg">{opt.icon}</span>
            <div className={`text-[10px] font-bold ${selectedTypes.includes(opt.value) ? 'text-white' : 'text-secondary'}`}>
              {opt.label}
            </div>
            {selectedTypes.includes(opt.value) && (
              <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue" />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4 bg-black/40 p-4 rounded-xl border border-white/5">
        <div>
          <div className="flex items-center gap-2 text-[10px] text-muted font-black uppercase tracking-widest mb-3">
            <Layers size={12} /> Target Floor
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map(f => (
              <button
                key={f}
                onClick={() => setSelectedFloors([f as FloorId])}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${
                  selectedFloors.includes(f as FloorId) 
                    ? 'bg-blue/20 border border-blue text-blue' 
                    : 'bg-white/5 border border-white/10 text-muted'
                }`}
              >
                LEVEL {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleDeploy}
        disabled={selectedTypes.length === 0}
        className={`w-full py-4 rounded-xl text-xs font-black tracking-[2px] transition-all duration-300 ${
          selectedTypes.length > 0 
            ? 'bg-blue text-white shadow-[0_8px_24px_-8px_rgba(59,130,246,0.6)] active:translate-y-0.5' 
            : 'bg-white/5 text-muted cursor-not-allowed opacity-50'
        }`}
      >
        DEPLOY TO SITE
      </button>
    </div>
  );
}
