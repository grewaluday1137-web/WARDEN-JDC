// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Auto-Simulation Controller
// Pre-generates a sequential scenario of 10–12 unique crisis events
// ═══════════════════════════════════════════════════════════════════════════════

import type { Zone, IncidentType, FloorId } from '../types';
import { ALL_FLOORS } from '../types';

interface ScheduledEvent {
  floor: FloorId;
  zone: string;
  type: IncidentType;
  triggerAtTick: number;
  fired: boolean;
}

const SCENARIO_TEMPLATES: IncidentType[][] = [
  ['fire', 'gas_leak', 'explosion'],
  ['gas_leak', 'fire', 'structural_collapse'],
  ['explosion', 'fire', 'gas_leak'],
  ['structural_collapse', 'fire', 'power_outage'],
];

export class AutoSimulator {
  private tickCount = 0;
  private scenarioQueue: ScheduledEvent[] = [];
  private firedEvents: ScheduledEvent[] = [];
  private active = false;

  /** 
   * Maps FloorId -> Available Zones on that floor.
   * This allows the global simulator to know what zones exist on each floor.
   */
  private floorZones: Map<FloorId, Zone[]> = new Map();

  start(floorZones: Map<FloorId, Zone[]>) {
    this.active = true;
    this.tickCount = 0;
    this.firedEvents = [];
    this.floorZones = floorZones;

    this.buildScenarioQueue();
  }

  stop() { this.active = false; }
  isActive() { return this.active; }

  getScenarioSize(): number { return this.scenarioQueue.length + this.firedEvents.length; }
  getFiredCount(): number { return this.firedEvents.length; }
  getRemainingCount(): number { return this.scenarioQueue.filter(e => !e.fired).length; }

  reset() {
    this.active = false;
    this.tickCount = 0;
    this.scenarioQueue = [];
    this.firedEvents = [];
  }

  private buildScenarioQueue() {
    const template = SCENARIO_TEMPLATES[Math.floor(Math.random() * SCENARIO_TEMPLATES.length)];
    this.scenarioQueue = [];
    
    // Pick a primary target floor and zone
    const targetFloor = ALL_FLOORS[Math.floor(Math.random() * ALL_FLOORS.length)];
    const zonesForFloor = this.floorZones.get(targetFloor) || ['A', 'B', 'C', 'D'];
    const targetZone = zonesForFloor[Math.floor(Math.random() * zonesForFloor.length)];

    // 10s warm up (master tick is 250ms, so 4 ticks = 1 sec. 40 ticks = 10s)
    let currentTick = 40; 

    // Stage 1: Incipient (Primary incident)
    this.scenarioQueue.push({
      floor: targetFloor,
      zone: targetZone,
      type: template[0],
      triggerAtTick: currentTick,
      fired: false,
    });

    // Stage 2: Growth (Spread after ~2 minutes real time = 480 ticks)
    currentTick += 480;
    const neighbors = zonesForFloor.filter(z => z !== targetZone);
    const neighborZone = neighbors.length > 0 ? neighbors[Math.floor(Math.random() * neighbors.length)] : targetZone;
    
    this.scenarioQueue.push({
      floor: targetFloor,
      zone: neighborZone,
      type: template[1] || 'fire',
      triggerAtTick: currentTick,
      fired: false,
    });

    // Stage 3: Peak (Critical failure after another ~3 minutes = 720 ticks)
    // Maybe spreads to another floor? Let's pick a random floor.
    currentTick += 720;
    const randomFloor = ALL_FLOORS[Math.floor(Math.random() * ALL_FLOORS.length)];
    const randomFloorZones = this.floorZones.get(randomFloor) || ['A'];
    
    this.scenarioQueue.push({
      floor: randomFloor,
      zone: randomFloorZones[Math.floor(Math.random() * randomFloorZones.length)],
      type: template[2] || 'structural_collapse',
      triggerAtTick: currentTick,
      fired: false,
    });

    console.log(`[GLOBAL AUTO] 📋 Narrative built: ${this.scenarioQueue.length} stages over ~${Math.floor(currentTick/4)}s real-time`);
    console.log(`[GLOBAL AUTO]    Timeline: ${this.scenarioQueue.map(e => `T${e.triggerAtTick}: F${e.floor}-${e.type}`).join(' → ')}`);
  }

  tick(): { floor: FloorId; zone: string; type: IncidentType } | null {
    if (!this.active) return null;
    this.tickCount++;

    const eventIndex = this.scenarioQueue.findIndex(e => !e.fired && e.triggerAtTick <= this.tickCount);
    if (eventIndex !== -1) {
      const event = this.scenarioQueue[eventIndex];
      event.fired = true;
      this.firedEvents.push(event);
      return { floor: event.floor, zone: event.zone, type: event.type };
    }

    return null;
  }

  scheduleEvent(floor: FloorId, zone: string, type: IncidentType, delayTicks: number) {
    this.scenarioQueue.push({
      floor,
      zone,
      type,
      triggerAtTick: this.tickCount + delayTicks,
      fired: false,
    });
  }
}

