import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SIMULATION_URL } from '../config';


export function useSimulationSocket() {
  const [connected, setConnected] = useState(false);
  const [simulationData, setSimulationData] = useState(null);

  useEffect(() => {
    const socket = io(SIMULATION_URL, {
      transports: ['websocket'],
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[SIM] Connected to Simulation Engine');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[SIM] Disconnected from Simulation Engine');
      setConnected(false);
    });

    socket.on('tick', (data) => {
      setSimulationData(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connected, simulationData };
}
