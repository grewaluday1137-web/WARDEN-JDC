import { useEffect, useRef } from 'react';
import { useCrisisStore, Alert } from '../store/useCrisisStore';

export const useExternalSocket = (url: string = 'ws://localhost:8000/ws/alerts') => {
  const { addExternalAlert } = useCrisisStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    console.log('[EXTERNAL-WS] 🔌 Connecting to Backend WebSocket:', url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[EXTERNAL-WS] ✅ Connected to Organization Backend');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'Alert_update' && payload.data?.alerts) {
          payload.data.alerts.forEach((rawAlert: any) => {
            const mappedAlert: Alert = {
              id: rawAlert.id,
              message: rawAlert.metadata?.event_msg || 'Incident reported by backend',
              severity: mapSeverity(rawAlert.metadata?.intensity || 'warning'),
              timestamp: new Date(rawAlert.timestamp * 1000).toISOString(),
              zone: rawAlert.location?.area || 'Unknown'
            };
            addExternalAlert(mappedAlert);
          });
        }
      } catch (err) {
        console.error('[EXTERNAL-WS] ❌ Error parsing message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[EXTERNAL-WS] ❌ WebSocket error:', err);
    };

    ws.onclose = () => {
      console.warn('[EXTERNAL-WS] 🔌 Disconnected from Organization Backend');
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return {};
};

function mapSeverity(intensity: string): 'info' | 'warning' | 'critical' {
  const low = intensity.toLowerCase();
  if (low === 'critical' || low === 'high') return 'critical';
  if (low === 'warning' || low === 'medium') return 'warning';
  return 'info';
}
