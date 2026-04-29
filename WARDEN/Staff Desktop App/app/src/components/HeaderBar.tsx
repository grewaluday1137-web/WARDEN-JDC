import { Shield, Radio, Layers } from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';

export function HeaderBar() {
  const store = useCrisisStore();

  return (
    <div className="flex flex-col gap-4">
      {/* Branding */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <div className="w-10 h-10 bg-blue/10 rounded-xl flex items-center justify-center border border-blue/20">
          <Shield size={22} className="text-blue" />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-black tracking-tight text-white uppercase italic">Crisis Desk</div>
          <div className="text-[9px] text-muted font-bold tracking-[1px] uppercase opacity-60 flex items-center gap-1.5">
             <div className={`w-1 h-1 rounded-full ${store.connected ? 'bg-emerald animate-pulse' : 'bg-red'}`} />
             {store.connected ? 'Secure Connection' : 'Offline Mode'}
          </div>
        </div>
      </div>

      {/* Floor Selection */}
      <div className="space-y-3">
        <div className="text-[10px] text-muted font-black uppercase tracking-widest flex items-center gap-2">
          <Layers size={12} className="text-secondary" /> Sector Control
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '3', value: 'F3_SECOND' },
            { label: '2', value: 'F2_FIRST' },
            { label: '1', value: 'F1_GROUND' }
          ].map(f => (
            <button
              key={f.value}
              onClick={() => store.setCurrentFloor(f.value)}
              className={`flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${
                store.currentFloor === f.value 
                  ? 'bg-blue/10 border-blue text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                  : 'bg-white/5 border-white/5 text-muted hover:border-white/20 hover:text-secondary'
              }`}
            >
              <span className="text-[14px] font-black">{f.label}</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter opacity-60">Level</span>
            </button>
          ))}
        </div>
      </div>

      {/* System Metrics */}
      <div className="bg-white/5 rounded-xl border border-white/5 p-3 space-y-2">
        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-muted">
          <span>System Heartbeat</span>
          <span className="text-secondary opacity-60 font-mono italic">ACTIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-blue animate-pulse" />
          <div className="font-mono text-[10px] text-secondary font-black">
            {store.lastSyncTimestamp ? new Date(store.lastSyncTimestamp).toLocaleTimeString([], { hour12: false }) : '--:--:--'}
          </div>
          <div className="ml-auto text-[9px] font-bold px-1.5 py-0.5 bg-white/5 rounded text-muted">
            SYNC OK
          </div>
        </div>
      </div>
    </div>
  );
}
