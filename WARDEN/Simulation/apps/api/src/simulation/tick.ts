import { GraphState, SimEntity, Zone, ZonePhysics } from '@crisis/types';
import { GraphData, buildGraph, cloneGraphState } from '../map/graph';
import { CrisisEventBus } from './eventBus';
import { propagateCrisis } from '../engine/propagation';
import { moveEntities } from '../engine/movement';

/**
 * GraphTickProcessor orchestrates the per-tick graph simulation.
 * It syncs macro-zone physics into micro-zones, propagates crisis,
 * moves entities, and produces an immutable GraphState snapshot.
 */
export class GraphTickProcessor {
  private graphData: GraphData;
  private eventBus: CrisisEventBus;
  private entities: SimEntity[] = [];
  private epicenters = new Map<Zone, Set<string>>();
  private floorId: number;

  constructor(eventBus: CrisisEventBus, floorId: number = 1) {
    this.floorId = floorId;
    this.graphData = buildGraph(floorId);
    this.eventBus = eventBus;
    
    // Epicenters should be empty initially and only populated via manual injection or auto-triggers
    this.epicenters = new Map<Zone, Set<string>>();
    
    console.log(`[GRAPH] Initialized with ${this.graphData.nodes.size} nodes, ${Array.from(this.graphData.edges.values()).reduce((sum, e) => sum + e.length, 0)} edges, ${this.graphData.zones.size} micro-zones`);
  }

  /**
   * Add an epicenter node for a zone (called when user injects an incident)
   */
  addEpicenter(zone: Zone, nodeId: string): void {
    if (!this.epicenters.has(zone)) {
      this.epicenters.set(zone, new Set());
    }
    this.epicenters.get(zone)!.add(nodeId);
    console.log(`[GRAPH] 📍 Epicenter ACTIVATED: ${nodeId} in Zone ${zone} (Floor ${this.floorId})`);
  }

  /**
   * Get current graph data (for other engines to reference)
   */
  getGraphData(): GraphData {
    return this.graphData;
  }

  /**
   * Get current entities
   */
  getEntities(): SimEntity[] {
    return this.entities;
  }

  /**
   * Set entities (called by evacuation engine when entities are created)
   */
  setEntities(entities: SimEntity[]): void {
    this.entities = entities;
  }

  /**
   * Main tick: processes graph simulation for one tick.
   *
   * Execution order:
   * 1. Sync macro-zone physics → micro-zone sensorData
   * 2. Propagate crisis across graph (fire, gas, structural)
   * 3. Move entities along their paths
   * 4. Collect events
   * 5. Return immutable GraphState snapshot
   */
  tick(zonePhysics: Record<Zone, ZonePhysics>, tickCount: number): GraphState {
    // Step 1: Sync macro-zone physics to micro-zone sensorData
    this.syncPhysicsToMicroZones(zonePhysics);

    // Step 2: Propagate crisis across graph
    const updatedZones = propagateCrisis(
      this.graphData.zones,
      this.graphData.edges,
      this.graphData.nodes,
      this.eventBus,
      tickCount
    );
    // Apply updated zones back to graph
    this.graphData.zones = updatedZones;

    // Step 3: Move entities
    if (this.entities.length > 0) {
      this.entities = moveEntities(
        this.entities,
        this.graphData.nodes,
        this.graphData.edges,
        this.graphData.zones,
        this.eventBus,
        tickCount
      );
    }

    // Step 4: Build immutable snapshot
    return cloneGraphState(this.graphData, this.entities);
  }

  /**
   * Sync macro zone physics (EnvironmentStore) to micro-zones (Graph)
   */
  public syncPhysicsToMicroZones(zonePhysics: Record<Zone, ZonePhysics>): void {
    for (const zone of this.graphData.zones.values()) {
      // 1. Natural dissipation for all micro-zones
      zone.sensorData.temperature += (22 - zone.sensorData.temperature) * 0.02;
      zone.sensorData.smoke += (0 - zone.sensorData.smoke) * 0.05;
      zone.sensorData.gas += (5 - zone.sensorData.gas) * 0.03;
      zone.sensorData.structural += (1 - zone.sensorData.structural) * 0.001;

      // 2. Apply epicenter physics
      for (const nodeId of zone.nodeIds) {
        const node = this.graphData.nodes.get(nodeId);
        if (node) {
          const zoneEpicenters = this.epicenters.get(node.parentZone as Zone);
          if (zoneEpicenters && zoneEpicenters.has(nodeId)) {
            const physics = zonePhysics[node.parentZone as Zone];
            if (physics) {
              // Apply physics maxes to epicenter
              if (physics.temperature > 25) zone.sensorData.temperature = Math.max(zone.sensorData.temperature, physics.temperature);
              if (physics.smokeDensity > 5) zone.sensorData.smoke = Math.max(zone.sensorData.smoke, physics.smokeDensity);
              if (physics.gasLevel > 10) zone.sensorData.gas = Math.max(zone.sensorData.gas, physics.gasLevel);
              if (physics.structuralIntegrity < 0.95) zone.sensorData.structural = Math.min(zone.sensorData.structural, physics.structuralIntegrity);
            }
          }
        }
      }
    }
  }

  /**
   * Get designated epicenter nodes for each zone
   */
  public getEpicenters(): Record<Zone, string[]> {
    const out: Partial<Record<Zone, string[]>> = {};
    for (const [z, ids] of this.epicenters) {
      out[z] = Array.from(ids);
    }
    return out as Record<Zone, string[]>;
  }

  /**
   * Reset graph state (called on simulation stop/reset)
   */
  reset(): void {
    this.graphData = buildGraph(this.floorId);
    this.entities = [];
    this.eventBus.clear();
    this.epicenters.clear();
    console.log(`[GRAPH] Reset to initial state for Floor ${this.floorId}`);
  }
}
