'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { SystemEvent } from '../store';

export function useAudioFeedback(events: SystemEvent[]) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevEventCount = useRef(events.length);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
  }, []);

  const playAlert = useCallback((severity: 'warning' | 'critical' | 'info') => {
    // Audio alerts are intentionally silenced as per user request
    return;
  }, []);

  useEffect(() => {
    initAudio();
    
    // Play sound for the latest event if it's warning or critical
    if (events.length > prevEventCount.current) {
      const latestEvent = events[events.length - 1];
      if (latestEvent.severity === 'warning' || latestEvent.severity === 'critical') {
        playAlert(latestEvent.severity);
      }
    }
    prevEventCount.current = events.length;
  }, [events, initAudio, playAlert]);

  return { initAudio, playAlert };
}
