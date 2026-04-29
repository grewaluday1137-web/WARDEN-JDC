import { useEffect, useRef } from 'react';
import { useCrisisStore, TickPayload, Incident } from '../store/useCrisisStore';
import mapData from '../data/map.json';
import { API_BASE_URL } from '../config';

export const useSocket = (url: string = API_BASE_URL) => {
  const { setConnected, processTick, currentFloor } = useCrisisStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    // Convert http/https to ws/wss for standard WebSocket
    const wsUrl = url.replace(/^http/, 'ws') + '/ws/alerts';
    console.log('[SOCKET] 🔌 Connecting to Backend WebSocket (Proxied Sim):', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[SOCKET] ✅ Connected to Backend Proxy');
      setConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // Handle proxied simulation ticks
        if (payload.type === 'simulation_tick') {
          transformAndProcess(payload.data);
        }
        
        // Handle direct snapshots if backend sends them
        if (payload.type === 'snapshot') {
          transformAndProcess(payload.data);
        }

        // Handle Alert updates from backend
        if (payload.type === 'Alert_update') {
          console.log('[SOCKET] 📥 Received Alert_update payload:', payload);
          const { alerts, summary, recommendations } = payload.data;
          
          // Process alerts
          if (alerts && Array.isArray(alerts)) {
            alerts.forEach((alert: any) => {
              let parsedDate = new Date();
              if (typeof alert.timestamp === 'number') {
                parsedDate = new Date(alert.timestamp * 1000);
              } else if (typeof alert.timestamp === 'string') {
                parsedDate = new Date(alert.timestamp);
              }
              
              // Convert to store Alert format if needed
              useCrisisStore.getState().addExternalAlert({
                id: alert.id,
                message: alert.metadata?.event_msg || alert.message || 'Critical Incident',
                severity: alert.metadata?.intensity || alert.severity || 'info',
                timestamp: parsedDate.toISOString(),
                zone: alert.location?.area || alert.zone,
                floor: alert.location?.floor || alert.floor,
                node: alert.location?.node || alert.node,
                eventType: alert.metadata?.incident_type || alert.eventType || alert.metadata?.event_type,
              });
            });
            
          }
          
          // Update AI insights for Predictions and Tasks panels
          if (summary || recommendations) {
            useCrisisStore.getState().updateAIInsights(summary, recommendations);
          }
        }
      } catch (err) {
        console.error('[SOCKET] ❌ Error parsing message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[SOCKET] ❌ WebSocket error:', err);
    };

    ws.onclose = () => {
      console.warn('[SOCKET] ❌ Disconnected from Backend Proxy — reconnecting...');
      setConnected(false);
      // Exponential backoff: 500ms → 1s → 2s → 4s → 8s → 10s cap
      const delay = Math.min(500 * Math.pow(2, reconnectAttempts.current), 10000);
      reconnectAttempts.current += 1;
      reconnectTimer.current = setTimeout(() => {
        console.log(`[SOCKET] 🔄 Reconnect attempt #${reconnectAttempts.current} (delay: ${delay}ms)`);
        // Force re-render to trigger useEffect and create new connection
        wsRef.current = null;
      }, delay);
    };

    const transformAndProcess = (data: any) => {
      const floorMap: Record<string, number> = {
        'F1_GROUND': 1,
        'F2_FIRST': 2,
        'F3_SECOND': 3
      };
      const fNum = floorMap[currentFloor] || 1;

      const fPhysics = data.floorPhysics?.[fNum] || {};
      const fStates = data.floorStates?.[fNum] || {};
      const fEpicenters = data.floorEpicenters?.[fNum] || {};

      const incidents: Incident[] = [];
      Object.entries(fEpicenters).forEach(([zoneId, nodeIds]: [string, any]) => {
        if (Array.isArray(nodeIds)) {
          nodeIds.forEach(nodeId => {
            const anchor = (mapData.anchors as any)[nodeId];
            if (anchor) {
              incidents.push({
                id: `inc-${nodeId}`,
                type: fStates[zoneId]?.type || 'Incident',
                zone: zoneId,
                severity: fStates[zoneId]?.severity || 'medium',
                phase: 'active',
                point: { x: anchor.x, y: anchor.y },
                floor: currentFloor
              });
            }
          });
        }
      });

      const people = (data.blePositions || []).filter((p: any) => {
        const pFloorNum = p.floor || 1;
        const pFloorId = pFloorNum === 1 ? 'F1_GROUND' : pFloorNum === 2 ? 'F2_FIRST' : 'F3_SECOND';
        return pFloorId === currentFloor;
      }).map((p: any) => ({
        id: p.id,
        role: p.role || 'guest',
        x: p.x / 10,
        y: p.y / 10,
        zone: p.zone,
        floor: currentFloor
      }));

      const transformed: TickPayload = {
        zones: fPhysics,
        incidents: incidents,
        people: people,
        predictions: data.predictions || [],
        tasks: data.playbook || [],
        alerts: [],
        events: data.events || [],
        simulationMode: data.simulationMode || data.mode
      };

      processTick(transformed);
    };

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.close();
    };
  }, [url, currentFloor]);

  return {
    emitCompleteTask: async (id: string) => {
      try {
        await fetch(`${url}/api/playbook/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            actionId: id, 
            floor: currentFloor === 'F2_FIRST' ? 2 : currentFloor === 'F3_SECOND' ? 3 : 1 
          })
        });
      } catch (err) {
        console.error('Failed to complete task via proxy:', err);
      }
    },
    emitBroadcastMessage: async (type: string, message: string) => {
      try {
        await fetch(`${url}/api/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: type, message: message })
        });
        console.log('[SOCKET] ✅ Broadcast sent via backend:', { type, message });
      } catch (err) {
        console.error('[SOCKET] ❌ Failed to send broadcast:', err);
      }
    }
  };
};
