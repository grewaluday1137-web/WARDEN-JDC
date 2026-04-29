import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws/alerts';
const RECONNECT_DELAY_MS = 3000;

/**
 * Custom hook that manages the WebSocket connection to the WARDEN backend.
 * Handles auto-reconnection and dispatches typed events to callbacks.
 */
export function useAlertSocket() {
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  // ── Merge helper — upserts alerts by ID ──────────────────────────────────
  const mergeAlerts = useCallback((incoming) => {
    setAlerts((prev) => {
      const map = new Map(prev.map((a) => [a.id, a]));
      incoming.forEach((a) => {
        const existing = map.get(a.id);
        map.set(a.id, existing ? { ...existing, ...a } : a);
      });
      // Sort: highest score first, then newest
      return Array.from(map.values()).sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.timestamp - a.timestamp
      );
    });
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected — reconnecting...');
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        switch (msg.type) {
          case 'Alert_update': {
            const newAlerts = msg.data?.alerts ?? [];
            mergeAlerts(newAlerts);
            break;
          }

          case 'alert_report_ready': {
            const { alert_id, ai_summary, detailed_report } = msg.data;
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === alert_id ? { ...a, ai_summary, detailed_report } : a
              )
            );
            break;
          }

          case 'alert_media_added': {
            const { alert_id, url } = msg.data;
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === alert_id
                  ? { ...a, media_attachments: [...(a.media_attachments || []), url] }
                  : a
              )
            );
            break;
          }

          case 'alert_status_changed': {
            const { alert_id, status } = msg.data;
            setAlerts((prev) =>
              prev.map((a) => (a.id === alert_id ? { ...a, status } : a))
            );
            break;
          }

          default:
            break;
        }
      } catch {
        // ignore non-JSON frames
      }
    };
  }, [mergeAlerts]);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, alerts };
}
