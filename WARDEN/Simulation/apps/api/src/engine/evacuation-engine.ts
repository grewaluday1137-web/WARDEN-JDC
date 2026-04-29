// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Evacuation Engine
// Simulates occupant evacuation through facility exits with pathfinding,
// dynamic rerouting around hazards, and responder assistance.
// Graph-based pathfinding is used when GraphData is available; falls back
// to the original greedy nearest-exit approach when it is not.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Zone, EvacuationAgent, EvacuationMetrics, EvacuationStatus,
  TrackedPerson, ZonePhysics, PersonRole, SimEntity, EntityStatus,
} from '@crisis/types';
import type { ConfigService } from '../services/config-service';
import { GraphData, findNearestNode } from '../map/graph';
import { CrisisEventBus } from '../simulation/eventBus';
import { findNearestExit, isPathSafe, isPathTraversable } from './pathfinding';
import { moveEntities, assignEvacuationPaths } from './movement';

interface ExitDef {
  id: string;
  zone: Zone;
  x: number;
  y: number;
  label: string;
  capacity: number;
  blocked: boolean;
}

function determineZone(x: number, y: number, graphData: GraphData | null): Zone {
  if (graphData) {
    const nearest = findNearestNode(graphData, x, y);
    return nearest.parentZone;
  }
  // Fallback for extremely legacy scenarios
  if (x <= 50 && y <= 50) return 'A';
  if (x > 50 && y <= 50) return 'B';
  if (x <= 50 && y > 50) return 'C';
  return 'D';
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ─── Hazard scoring ──────────────────────────────────────────────────────────
function zoneHazardLevel(physics: ZonePhysics): number {
  let hazard = 0;
  if (physics.temperature > 45) hazard += Math.min(1, (physics.temperature - 45) / 75);
  if (physics.smokeDensity > 15) hazard += Math.min(1, physics.smokeDensity / 100) * 0.5;
  if (physics.gasLevel > 50) hazard += Math.min(1, physics.gasLevel / 500) * 0.4;
  if (physics.fireIntensity > 0.1) hazard += physics.fireIntensity * 0.8;
  if (physics.structuralIntegrity < 0.7) hazard += (1 - physics.structuralIntegrity) * 0.6;
  return Math.min(1, hazard);
}

export class EvacuationEngine {
  private agents: EvacuationAgent[] = [];
  private entities: SimEntity[] = [];
  private exits: ExitDef[] = [];
  private isActive = false;
  private startTick = 0;
  private evacuatedCount = 0;
  private totalEvacTimeTicks = 0;
  private reroutes = 0;
  private blockedExitImpacts = 0;
  private configService: ConfigService | null;
  private graphData: GraphData | null = null;
  private eventBus: CrisisEventBus | null = null;

  constructor(configService?: ConfigService, graphData?: GraphData, eventBus?: CrisisEventBus) {
    this.configService = configService ?? null;
    this.graphData = graphData ?? null;
    this.eventBus = eventBus ?? null;
  }

  /**
   * Late-bind graph data and event bus (useful when graph is built after engine instantiation).
   */
  setGraphData(graphData: GraphData, eventBus: CrisisEventBus): void {
    this.graphData = graphData;
    this.eventBus = eventBus;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Start evacuation from BLE-tracked people */
  start(
    trackedPeople: TrackedPerson[],
    currentTick: number,
  ): void {
    if (this.isActive) return;

    // Load exits from config
    this.exits = this.loadExits();

    // Convert tracked people → evacuation agents
    this.agents = trackedPeople.map(p => ({
      id: p.id,
      role: p.role,
      currentZone: p.zone,
      x: p.x,
      y: p.y,
      targetExitId: null,
      status: 'idle' as EvacuationStatus,
      riskExposure: 0,
      pathHistory: [p.zone],
    }));

    // Assign initial exits (greedy or graph-based)
    for (const agent of this.agents) {
      if (agent.role === 'responder') {
        agent.status = 'assisting';
      } else {
        this.assignExit(agent, null);
        agent.status = agent.targetExitId ? 'moving' : 'trapped';
      }
    }

    // ── Graph-mode: create SimEntity[] snapped to nearest graph nodes ─────────
    if (this.graphData) {
      const rawEntities: SimEntity[] = trackedPeople.map(p => {
        const nearestNode = findNearestNode(this.graphData!, p.x, p.y);
        return {
          id: p.id,
          type: p.role as PersonRole,
          currentNode: nearestNode.id,
          path: [],
          status: p.role === 'responder' ? ('moving' as EntityStatus) : ('evacuating' as EntityStatus),
          riskExposure: 0,
        };
      });

      // Assign evacuation paths via graph pathfinding
      this.entities = assignEvacuationPaths(
        rawEntities,
        this.graphData.nodes,
        this.graphData.edges,
        this.graphData.zones,
      );

      // Sync initial graph positions/status back to EvacuationAgents
      this.syncEntitiesToAgents(currentTick);
    }

    this.isActive = true;
    this.startTick = currentTick;
    this.evacuatedCount = 0;
    this.totalEvacTimeTicks = 0;
    this.reroutes = 0;
    this.blockedExitImpacts = 0;

    console.log(
      `[EVAC] 🚨 Evacuation started: ${this.agents.length} agents, ` +
      `${this.exits.filter(e => !e.blocked).length}/${this.exits.length} exits available` +
      (this.graphData ? ' [graph-mode]' : ' [greedy-mode]'),
    );
  }

  /** Stop / cancel evacuation */
  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    console.log(`[EVAC] ✅ Evacuation stopped — ${this.evacuatedCount} evacuated`);
  }

  /** Reset to clean state */
  reset(): void {
    this.agents = [];
    this.entities = [];
    this.exits = [];
    this.isActive = false;
    this.evacuatedCount = 0;
    this.totalEvacTimeTicks = 0;
    this.reroutes = 0;
    this.blockedExitImpacts = 0;
  }

  // ─── Tick ───────────────────────────────────────────────────────────────────

  tick(
    allPhysics: Record<Zone, ZonePhysics>,
    currentTick: number,
  ): void {
    if (!this.isActive) return;

    // Reload exits (blocked status may change)
    this.exits = this.loadExits();

    // ── Graph-mode tick ────────────────────────────────────────────────────────
    if (this.graphData && this.entities.length > 0 && this.eventBus) {
      const prevEntities = this.entities;

      this.entities = moveEntities(
        this.entities,
        this.graphData.nodes,
        this.graphData.edges,
        this.graphData.zones,
        this.eventBus,
        currentTick,
      );

      // Count reroutes: entities whose path was recalculated (path changed but not because they moved)
      for (let i = 0; i < this.entities.length; i++) {
        const prev = prevEntities[i];
        const curr = this.entities[i];
        // A reroute is signaled when an entity that was evacuating or moving still has a path
        // but it was recalculated (path length changed non-monotonically relative to advancing one step)
        if (
          curr.status !== 'trapped' &&
          prev.path.length > 0 &&
          curr.path.length > 0 &&
          curr.currentNode === prev.currentNode
        ) {
          // Path changed without advancing → it was recalculated
          if (curr.path[0] !== prev.path[0]) {
            this.reroutes++;
          }
        }
      }

      // Sync SimEntity results back to EvacuationAgents and update metrics
      this.syncEntitiesToAgents(currentTick);
    } else {
      // ── Greedy fallback tick (original logic) ─────────────────────────────
      for (const agent of this.agents) {
        if (agent.status === 'evacuated') continue;

        // Responders move toward highest-hazard zone with trapped people
        if (agent.status === 'assisting') {
          this.tickResponder(agent, allPhysics);
          continue;
        }

        // Accumulate risk exposure
        const zoneHazard = zoneHazardLevel(allPhysics[agent.currentZone]);
        agent.riskExposure = Math.min(1, agent.riskExposure + zoneHazard * 0.02);

        // Check if current exit is blocked → reroute
        if (agent.targetExitId) {
          const exit = this.exits.find(e => e.id === agent.targetExitId);
          if (!exit || exit.blocked) {
            this.reroutes++;
            if (exit?.blocked) this.blockedExitImpacts++;
            this.assignExit(agent, allPhysics);
            if (!agent.targetExitId) {
              agent.status = 'trapped';
              continue;
            }
          }
        }

        if (!agent.targetExitId) {
          agent.status = 'trapped';
          continue;
        }

        // Move toward exit
        const exit = this.exits.find(e => e.id === agent.targetExitId)!;
        const speed = this.getAgentSpeed(agent, allPhysics[agent.currentZone]);
        const d = dist(agent.x, agent.y, exit.x, exit.y);

        if (d <= speed) {
          // Arrived at exit
          agent.x = exit.x;
          agent.y = exit.y;
          agent.status = 'evacuated';
          agent.currentZone = exit.zone;
          this.evacuatedCount++;
          this.totalEvacTimeTicks += (currentTick - this.startTick);
        } else {
          // Step toward exit
          const dx = (exit.x - agent.x) / d * speed;
          const dy = (exit.y - agent.y) / d * speed;
          agent.x = Math.max(0, Math.min(100, agent.x + dx));
          agent.y = Math.max(0, Math.min(100, agent.y + dy));
          agent.currentZone = determineZone(agent.x, agent.y, this.graphData);

          // Track zone transitions
          const lastZone = agent.pathHistory[agent.pathHistory.length - 1];
          if (agent.currentZone !== lastZone) {
            agent.pathHistory.push(agent.currentZone);
          }
        }
      }
    }

    // Check for completion
    const remaining = this.agents.filter(a => a.status === 'moving' || a.status === 'idle');
    if (remaining.length === 0 && this.agents.length > 0) {
      console.log(
        `[EVAC] 🏁 Evacuation complete — ${this.evacuatedCount} evacuated, ` +
        `${this.agents.filter(a => a.status === 'trapped').length} trapped`,
      );
    }
  }

  // ─── Entity ↔ Agent Sync ────────────────────────────────────────────────────

  /**
   * Sync SimEntity state back into EvacuationAgent for public API compatibility.
   */
  private syncEntitiesToAgents(currentTick: number): void {
    if (!this.graphData) return;

    for (const entity of this.entities) {
      const agentIndex = this.agents.findIndex(a => a.id === entity.id);
      if (agentIndex === -1) continue;

      const existing = this.agents[agentIndex];
      const wasEvacuated = existing.status === 'evacuated';

      this.agents[agentIndex] = this.entityToAgent(entity, existing);

      // Count new evacuations
      if (!wasEvacuated && this.agents[agentIndex].status === 'evacuated') {
        this.evacuatedCount++;
        this.totalEvacTimeTicks += (currentTick - this.startTick);
      }
    }
  }

  /**
   * Map a SimEntity + its existing EvacuationAgent into an updated EvacuationAgent.
   */
  private entityToAgent(entity: SimEntity, existingAgent: EvacuationAgent): EvacuationAgent {
    const node = this.graphData?.nodes.get(entity.currentNode);
    return {
      ...existingAgent,
      x: node?.x ?? existingAgent.x,
      y: node?.y ?? existingAgent.y,
      currentZone: (node?.parentZone ?? existingAgent.currentZone) as Zone,
      status: this.mapEntityStatus(entity.status, existingAgent.role),
      riskExposure: entity.riskExposure,
    };
  }

  /**
   * Map an EvacuationAgent to a SimEntity for graph processing.
   */
  private agentToEntity(agent: EvacuationAgent): SimEntity {
    const nearestNode = findNearestNode(this.graphData!, agent.x, agent.y);
    return {
      id: agent.id,
      type: agent.role as PersonRole,
      currentNode: nearestNode.id,
      path: [],
      status: this.mapAgentStatus(agent.status),
      riskExposure: agent.riskExposure,
    };
  }

  /**
   * Map EntityStatus → EvacuationStatus for the public agent API.
   * `idle` after reaching an exit node means evacuated in the context of evacuation mode.
   */
  private mapEntityStatus(status: EntityStatus, role: PersonRole): EvacuationStatus {
    switch (status) {
      case 'evacuating': return 'moving';
      case 'moving':     return role === 'responder' ? 'assisting' : 'moving';
      case 'trapped':    return 'trapped';
      case 'idle':       return 'evacuated'; // idle after exit = evacuated
      default:           return 'idle';
    }
  }

  /**
   * Map EvacuationStatus → EntityStatus for graph processing.
   */
  private mapAgentStatus(status: EvacuationStatus): EntityStatus {
    switch (status) {
      case 'moving':    return 'evacuating';
      case 'assisting': return 'moving';
      case 'trapped':   return 'trapped';
      case 'evacuated': return 'idle';
      default:          return 'evacuating';
    }
  }

  // ─── Agent Movement ─────────────────────────────────────────────────────────

  private getAgentSpeed(agent: EvacuationAgent, physics: ZonePhysics): number {
    const baseSpeed = agent.role === 'staff' ? 2.5 : 2.0;
    const hazard = zoneHazardLevel(physics);
    // Smoke slows movement significantly
    const smokePenalty = Math.max(0, 1 - physics.smokeDensity / 100 * 0.8);
    // High hazard slows people
    const hazardPenalty = Math.max(0.3, 1 - hazard * 0.5);
    return baseSpeed * smokePenalty * hazardPenalty;
  }

  private tickResponder(agent: EvacuationAgent, allPhysics: Record<string, ZonePhysics>): void {
    // Find zone with most trapped people
    const trappedByZone: Record<string, number> = {};
    for (const a of this.agents) {
      if (a.status === 'trapped') {
        trappedByZone[a.currentZone] = (trappedByZone[a.currentZone] || 0) + 1;
      }
    }

    let targetZone: string | null = null;
    let maxTrapped = 0;
    for (const [z, count] of Object.entries(trappedByZone)) {
      if (count > maxTrapped) {
        maxTrapped = count;
        targetZone = z;
      }
    }

    if (!targetZone) return;

    // Move toward center of target zone (or target node if graph available)
    let target: { x: number; y: number };
    if (this.graphData) {
      // Find a node in the target zone
      const node = Array.from(this.graphData.nodes.values()).find(n => n.parentZone === targetZone);
      target = node ? { x: node.x, y: node.y } : { x: 50, y: 50 };
    } else {
      const zoneCenter: Record<string, { x: number; y: number }> = { A: { x: 25, y: 25 }, B: { x: 75, y: 25 }, C: { x: 25, y: 75 }, D: { x: 75, y: 75 } };
      target = zoneCenter[targetZone!] || { x: 50, y: 50 };
    }
    
    const d = dist(agent.x, agent.y, target.x, target.y);
    const speed = 3.0; // Responders move faster

    if (d > speed) {
      agent.x += (target.x - agent.x) / d * speed;
      agent.y += (target.y - agent.y) / d * speed;
      agent.currentZone = determineZone(agent.x, agent.y, this.graphData);
    }

    // If responder reaches a trapped person's zone, un-trap nearby people
    if (agent.currentZone === targetZone) {
      for (const a of this.agents) {
        if (a.status === 'trapped' && a.currentZone === targetZone) {
          this.assignExit(a, allPhysics);
          if (a.targetExitId) {
            a.status = 'moving';
          }
        }
      }
    }

    // Accumulate risk
    const hazard = zoneHazardLevel(allPhysics[agent.currentZone]);
    agent.riskExposure = Math.min(1, agent.riskExposure + hazard * 0.01);
  }

  // ─── Exit Assignment ────────────────────────────────────────────────────────

  private assignExit(
    agent: EvacuationAgent,
    allPhysics: Record<Zone, ZonePhysics> | null,
  ): void {
    // ── Graph-mode: use A* to find nearest exit node ───────────────────────
    if (this.graphData) {
      const nearestNode = findNearestNode(this.graphData, agent.x, agent.y);
      const exitPath = findNearestExit(
        nearestNode.id,
        this.graphData.nodes,
        this.graphData.edges,
        this.graphData.zones,
        { avoidDangerous: agent.role === 'guest' },
      );

      if (exitPath && exitPath.length > 0) {
        const exitNodeId = exitPath[exitPath.length - 1];
        // Map graph exit node ID to the classic exit definition ID
        // The exit node ID may match an ExitDef id; fallback to the node id itself
        const exitNode = this.graphData.nodes.get(exitNodeId);
        const matchedExit = this.exits.find(e => !e.blocked && e.id === exitNodeId);
        if (matchedExit) {
          agent.targetExitId = matchedExit.id;
        } else if (exitNode) {
          // Use nearest unblocked classical exit to the graph exit node's coordinates
          const closestClassicExit = this.exits
            .filter(e => !e.blocked)
            .sort((a, b) => dist(a.x, a.y, exitNode.x, exitNode.y) - dist(b.x, b.y, exitNode.x, exitNode.y))[0];
          agent.targetExitId = closestClassicExit?.id ?? null;
        } else {
          agent.targetExitId = null;
        }
      } else {
        agent.targetExitId = null;
      }
      return;
    }

    // ── Greedy fallback: score exits by distance + hazard cost ─────────────
    const available = this.exits.filter(e => !e.blocked);
    if (available.length === 0) {
      agent.targetExitId = null;
      return;
    }

    let bestExit: ExitDef | null = null;
    let bestScore = Infinity;

    for (const exit of available) {
      const d = dist(agent.x, agent.y, exit.x, exit.y);
      let hazardCost = 0;

      if (allPhysics) {
        const exitZoneHazard = zoneHazardLevel(allPhysics[exit.zone]);
        hazardCost = exitZoneHazard * 50;
      }

      const score = d + hazardCost;
      if (score < bestScore) {
        bestScore = score;
        bestExit = exit;
      }
    }

    agent.targetExitId = bestExit?.id ?? null;
  }

  // ─── Config Loading ─────────────────────────────────────────────────────────

  private loadExits(): ExitDef[] {
    if (!this.configService) {
      return this.defaultExits();
    }
    try {
      const config = this.configService.loadFacilityConfig();
      if (config.exits && config.exits.length > 0) {
        return config.exits as ExitDef[];
      }
    } catch { /* fallback */ }
    return this.defaultExits();
  }

  private defaultExits(): ExitDef[] {
    return [
      { id: 'EXIT-NW', zone: 'A' as Zone, x: 0, y: 0, label: 'NW Exit', capacity: 5, blocked: false },
      { id: 'EXIT-NE', zone: 'B' as Zone, x: 100, y: 0, label: 'NE Exit', capacity: 5, blocked: false },
      { id: 'EXIT-SW', zone: 'C' as Zone, x: 0, y: 100, label: 'SW Exit', capacity: 8, blocked: false },
      { id: 'EXIT-SE', zone: 'D' as Zone, x: 100, y: 100, label: 'SE Exit', capacity: 10, blocked: false },
    ];
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  getAgents(): EvacuationAgent[] {
    return [...this.agents];
  }

  /** Expose SimEntity[] for the graph tick processor / cloneGraphState. */
  getEntities(): SimEntity[] {
    return [...this.entities];
  }

  isRunning(): boolean {
    return this.isActive;
  }

  getMetrics(currentTick: number): EvacuationMetrics | null {
    if (!this.isActive && this.agents.length === 0) return null;

    const trapped = this.agents.filter(a => a.status === 'trapped').length;
    const moving = this.agents.filter(a => a.status === 'moving' || a.status === 'idle').length;
    const evacuated = this.evacuatedCount;

    // Find highest risk zone
    let highestRiskZone: string | null = null;
    let highestRisk = 0;
    const riskByZone: Record<string, number> = {};
    const countByZone: Record<string, number> = {};

    for (const a of this.agents) {
      if (a.status !== 'evacuated') {
        riskByZone[a.currentZone] = (riskByZone[a.currentZone] || 0) + a.riskExposure;
        countByZone[a.currentZone] = (countByZone[a.currentZone] || 0) + 1;
      }
    }
    for (const [z, totalRisk] of Object.entries(riskByZone)) {
      const avgRisk = totalRisk / countByZone[z];
      if (avgRisk > highestRisk) {
        highestRisk = avgRisk;
        highestRiskZone = z;
      }
    }

    // Check for responder arrival
    const responderAgents = this.agents.filter(a => a.role === 'responder');
    let responderArrivalTicks: number | null = null;
    if (responderAgents.length > 0) {
      const trappedZones = new Set(
        this.agents.filter(a => a.status === 'trapped').map(a => a.currentZone),
      );
      const arrivedResponder = responderAgents.find(r => trappedZones.has(r.currentZone));
      if (arrivedResponder) {
        responderArrivalTicks = currentTick - this.startTick;
      }
    }

    return {
      totalOccupants: this.agents.length,
      evacuatedCount: evacuated,
      trappedCount: trapped,
      movingCount: moving,
      avgEvacuationTimeTicks: evacuated > 0 ? Math.round(this.totalEvacTimeTicks / evacuated) : 0,
      responderArrivalTicks,
      highestRiskZone,
      reroutes: this.reroutes,
      blockedExitImpacts: this.blockedExitImpacts,
    };
  }
}
