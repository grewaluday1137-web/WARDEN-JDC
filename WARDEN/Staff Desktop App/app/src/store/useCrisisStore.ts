import { create } from 'zustand';
import { PlaybookAction, Prediction, SystemEvent } from '../types';
export type { PlaybookAction, Prediction, SystemEvent };

// Types
export interface Point {
  x: number; // 0-100
  y: number; // 0-100
}

export interface ZoneData {
  temperature: number;
  smoke: number;
  gas: number;
  fireIntensity: number;
  structuralIntegrity: number;
}

export interface Incident {
  id: string;
  type: string;
  zone: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  phase: string;
  point: Point;
  floor?: string;
}

export interface Person {
  id: string;
  role: 'staff' | 'guest' | 'responder';
  x: number;
  y: number;
  zone: string;
  floor?: string;
}

// Use imported types

// Use imported PlaybookAction

export interface Alert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  zone?: string;
  floor?: string | number;
  node?: string;
  eventType?: string;
  ai_summary?: string;
  detailed_report?: string;
}

export interface TickPayload {
  zones: Record<string, ZoneData>;
  incidents: Incident[];
  people: Person[];
  predictions: Prediction[];
  tasks: PlaybookAction[];
  alerts: Alert[];
  events: SystemEvent[];
  simulationMode?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  zone?: string;
  floor?: string;
}

interface CrisisState {
  // Connection
  connected: boolean;
  setConnected: (status: boolean) => void;
  mockMode: boolean;
  setMockMode: (status: boolean) => void;
  currentFloor: string;
  setCurrentFloor: (floor: string) => void;

  // Data
  tickData: TickPayload | null;
  externalAlerts: Alert[];
  lastSyncTimestamp: string | null;
  processTick: (payload: TickPayload) => void;
  addExternalAlert: (alert: Alert) => void;
  updateExternalAlert: (id: string, updates: Partial<Alert>) => void;
  clearExternalAlerts: () => void;
  updateAIInsights: (summary: any, recommendations: any) => void;

  // Toasts
  activeToasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Derived state properties
  systemStatus: 'Stable' | 'Escalating' | 'Critical';
}

// Clean initial state (no active incidents or mock data)
const INITIAL_DATA: TickPayload = {
  zones: {},
  incidents: [],
  people: [],
  predictions: [],
  tasks: [],
  alerts: [],
  events: []
};

const determineStatus = (tick: TickPayload) => {
  if (!tick.incidents || tick.incidents.length === 0) return 'Stable';
  const hasCritical = tick.incidents.some(i => i.severity === 'critical');
  if (hasCritical) return 'Critical';
  const hasMedium = tick.incidents.some(i => i.severity === 'medium' || i.severity === 'high');
  if (hasMedium) return 'Escalating';
  return 'Stable';
};

export const useCrisisStore = create<CrisisState>((set, get) => ({
  connected: false,
  mockMode: false,
  currentFloor: 'F1_GROUND',
  setConnected: (status) => set({ connected: status }),
  setMockMode: (status) => set({ mockMode: status }),
  setCurrentFloor: (floor) => set({ currentFloor: floor }),

  tickData: INITIAL_DATA,
  externalAlerts: [],
  lastSyncTimestamp: null,
  processTick: (payload) => {
    const currentState = get();

    if (currentState.mockMode) {
      set({ mockMode: false });
    }

    // Extract existing local AI insights so they aren't overwritten by the server tick
    const currentPredictions = currentState.tickData?.predictions || [];
    const currentTasks = currentState.tickData?.tasks || [];

    const isLocalAIPred = (p: Prediction) => p.id.startsWith('ai-');
    const isLocalAITask = (t: PlaybookAction) => t.id.startsWith('ai-');

    const localAIPreds = currentPredictions.filter(isLocalAIPred);
    const localAITasks = currentTasks.filter(isLocalAITask);

    const backendPreds = (payload.predictions || []).filter(p => !isLocalAIPred(p));
    const backendTasks = (payload.tasks || []).filter(t => !isLocalAITask(t));

    // Overwrite with fresh data from backend but merge local AI insights
    const processedPayload: TickPayload = {
      zones: payload.zones || {},
      incidents: payload.incidents || [],
      people: payload.people || [],
      predictions: [...backendPreds, ...localAIPreds],
      tasks: [...backendTasks, ...localAITasks],
      alerts: payload.alerts || [],
      events: payload.events || [],
      simulationMode: payload.simulationMode
    };

    // Detect new critical alerts and push them as toasts
    if (payload.alerts) {
      payload.alerts.forEach(alert => {
        if (alert.severity === 'critical') {
          const preExists = currentState.tickData?.alerts.find(a => a.id === alert.id);
          if (!preExists) {
            currentState.addToast({ message: alert.message, severity: 'critical', zone: alert.zone });
          }
        }
      });
    }

    set({
      tickData: processedPayload,
      systemStatus: determineStatus(processedPayload),
      lastSyncTimestamp: new Date().toISOString()
    });
  },

  activeToasts: [],
  addToast: (toastProps) => {
    const id = Math.random().toString(36).substring(7);
    const toast = { ...toastProps, id };
    set((state) => ({ activeToasts: [...state.activeToasts, toast] }));
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 5000);
  },
  removeToast: (id) => set((state) => ({
    activeToasts: state.activeToasts.filter(t => t.id !== id)
  })),

  addExternalAlert: (alert) => {
    set((state) => {
      const exists = state.externalAlerts.find(a => a.id === alert.id);
      if (exists) {
        // Update existing alert with new fields (like ai_summary, detailed_report)
        return {
          externalAlerts: state.externalAlerts.map(a => a.id === alert.id ? { ...a, ...alert } : a)
        };
      }

      // Also trigger a toast for critical external alerts
      if (alert.severity === 'critical') {
        state.addToast({ message: `[BACKEND] ${alert.message}`, severity: 'critical', zone: alert.zone });
      }

      return { externalAlerts: [alert, ...state.externalAlerts].slice(0, 50) };
    });
  },

  updateExternalAlert: (id: string, updates: Partial<Alert>) => {
    set((state) => ({
      externalAlerts: state.externalAlerts.map(a => a.id === id ? { ...a, ...updates } : a)
    }));
  },

  clearExternalAlerts: () => set({ externalAlerts: [] }),

  updateAIInsights: (_summary, recommendations) => {
    set((state) => {
      if (!state.tickData) return state;

      const newPredictions: Prediction[] = [];
      const newTasks: PlaybookAction[] = [];

      // Map recommendations to tasks
      if (recommendations) {
        let stepCount = 1;

        // Map staff recommendations
        if (recommendations.staff && Array.isArray(recommendations.staff)) {
          recommendations.staff.forEach((rec: string) => {
            newTasks.push({
              id: `ai-staff-${stepCount}`,
              step: stepCount++,
              label: rec,
              completed: false,
              role: 'staff'
            });
          });
        }

        // Map guest recommendations as predictions/insights
        if (recommendations.guests && Array.isArray(recommendations.guests)) {
          let predCount = 1;
          recommendations.guests.forEach((predText: string) => {
            newPredictions.push({
              id: `ai-pred-${predCount++}`,
              incidentType: 'AI Insight',
              zone: 'System-wide',
              confidence: 0.85 + (Math.random() * 0.1), // Random high confidence
              reasoning: predText,
              eta: Math.floor(Math.random() * 60) + 30, // 30-90s
              sourceZone: 'AI',
              sourceIncident: 'AI Insight',
              linkType: 'gas'
            });
          });
        }
      }

      return {
        tickData: {
          ...state.tickData,
          predictions: newPredictions,
          tasks: newTasks
        }
      };
    });
  },

  systemStatus: 'Stable',
}));
