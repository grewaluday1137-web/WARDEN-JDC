import React from 'react';
import { motion } from 'framer-motion';
import { Check, ShieldOff, Terminal, Activity } from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444', resolved: '#10b981',
};

export function PlaybookPanel() {
  const { tickData } = useCrisisStore();
  const playbook = tickData?.tasks || [];

  const handleActionClick = async (actionId: string) => {
    try {
      await fetch(`http://localhost:8000/api/playbook/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId })
      });
    } catch (err) {
      console.error('Failed to complete action:', err);
    }
  };

  if (playbook.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-4 bg-white/5 rounded-xl border border-white/10 opacity-60">
        <ShieldOff size={32} className="text-muted" />
        <div className="text-xs text-muted font-medium">
          Action playbook is empty. Reactive procedures will appear here once threats are confirmed.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[10px] text-muted font-black uppercase tracking-widest px-1">
        <Activity size={12} className="text-blue" /> Action Playbook
      </div>
      <div className="space-y-2">
        {playbook.map(action => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => !action.completed && handleActionClick(action.id)}
            className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${action.completed
                ? 'bg-emerald/5 border-emerald/20 opacity-60'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${action.completed ? 'bg-emerald' : 'bg-white/10'
              }`}>
              {action.completed && <Check size={14} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[11px] font-bold leading-tight ${action.completed ? 'text-emerald' : 'text-secondary'}`}>
                {action.label}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[9px] font-black uppercase tracking-wider">
                <span className="text-blue px-1.5 py-0.5 bg-blue/10 rounded">LEVEL {action.zone?.split('_')[0].replace('F', '') || '1'}</span>
                <span className="text-muted">•</span>
                <span className="text-muted">ZONE {action.zone || 'ALL'}</span>
                {action.completed && <span className="text-emerald ml-auto">✓ MITIGATED</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function EventLog() {
  const { tickData } = useCrisisStore();
  const events = tickData?.events || [];
  const reversed = [...events].reverse();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar"
      >
        {reversed.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
            <Terminal size={32} className="mb-3" />
            <div className="text-[11px] font-bold uppercase tracking-widest">No Active Signals</div>
            <div className="text-[10px]">Monitoring site data streams...</div>
          </div>
        ) : (
          reversed.map(event => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`group relative overflow-hidden p-4 rounded-xl border transition-all ${event.severity === 'critical'
                  ? 'bg-red/10 border-red/30 shadow-[0_4px_12px_rgba(239,68,68,0.1)]'
                  : event.severity === 'warning'
                    ? 'bg-amber/5 border-amber/20'
                    : 'bg-white/5 border-white/10'
                }`}
            >
              {/* Severity Accent Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: SEVERITY_COLORS[event.severity] || '#666' }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-[10px] font-black uppercase tracking-widest ${event.severity === 'critical' ? 'text-red' : 'text-secondary'
                    }`}>
                    {event.source.replace('_', ' ')}
                  </div>
                  <div className="font-mono text-[9px] text-muted opacity-60">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
                  </div>
                </div>

                <div className={`text-[12px] leading-relaxed font-medium mb-3 ${event.severity === 'critical' ? 'text-white' : 'text-secondary'
                  }`}>
                  {event.message}
                </div>

                <div className="flex items-center gap-3 font-mono text-[9px]">
                  {event.floor && (
                    <span className="flex items-center gap-1 text-blue font-bold px-1.5 py-0.5 bg-blue/10 rounded">
                      L{event.floor}
                    </span>
                  )}
                  {event.zone && (
                    <span className="flex items-center gap-1 text-secondary font-bold px-1.5 py-0.5 bg-white/5 rounded">
                      ZONE {event.zone}
                    </span>
                  )}
                  {event.severity === 'critical' && (
                    <span className="ml-auto flex items-center gap-1 text-red font-black animate-pulse">
                      <ShieldOff size={10} /> IMMEDIATE ACTION REQUIRED
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
