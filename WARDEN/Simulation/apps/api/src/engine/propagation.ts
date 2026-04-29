import { GraphNode, GraphEdge, MicroZone, CrisisEvent } from '@crisis/types';
import { CrisisEventBus } from '../simulation/eventBus';

/** Speed multipliers by zone type for fire spread */
const FIRE_SPEED: Record<string, number> = {
  corridor: 1.5,
  public: 1.2,
  core: 1.0,
  private: 0.8,
  hazard: 1.3,
  critical: 0.6,
};

/** Gas spreads 2x faster than fire */
const GAS_SPEED_MULTIPLIER = 2.0;

/** Structural damage risk increment per tick for connected nodes */
const STRUCTURAL_RISK_INCREMENT = 15;

/** Threshold below which structural damage propagates */
const STRUCTURAL_DAMAGE_THRESHOLD = 0.4;

/**
 * Propagate crisis effects across the graph for one tick.
 * Returns a NEW Map of zones (immutable -- does not modify input).
 */
export function propagateCrisis(
  zones: Map<string, MicroZone>,
  edges: Map<string, GraphEdge[]>,
  nodes: Map<string, GraphNode>,
  eventBus: CrisisEventBus,
  tickCount: number
): Map<string, MicroZone> {
  // Deep clone all zones for immutability
  const updatedZones = new Map<string, MicroZone>();
  for (const [id, zone] of zones) {
    updatedZones.set(id, {
      ...zone,
      sensorData: { ...zone.sensorData },
      nodeIds: [...zone.nodeIds],
    });
  }

  // Build a node-to-zone lookup
  const nodeToZone = new Map<string, string>();
  for (const [zoneId, zone] of zones) {
    for (const nodeId of zone.nodeIds) {
      nodeToZone.set(nodeId, zoneId);
    }
  }

  // --- PROPAGATION DISABLED BY USER REQUEST ---
  // "the event must only occur on only one node and no where else"
  /* 
  // For each zone with active fire (temperature > 45 or smoke > 15), propagate to connected zones
  for (const [sourceZoneId, sourceZone] of zones) {
    ...
  }
  */

  // --- RECALCULATE RISK LEVELS ---
  for (const [zoneId, zone] of updatedZones) {
    const sd = zone.sensorData;
    const tempContrib = Math.min(30, Math.max(0, (sd.temperature - 22) / 98 * 30));
    const smokeContrib = Math.min(25, sd.smoke / 100 * 25);
    const gasContrib = Math.min(25, sd.gas / 500 * 25);
    const structContrib = Math.min(20, (1 - sd.structural) * 20);

    const newRisk = Math.round(Math.min(100, Math.max(0, tempContrib + smokeContrib + gasContrib + structContrib)));

    if (newRisk !== zone.riskLevel) {
      zone.riskLevel = newRisk;
      eventBus.publish({
        type: 'RISK_UPDATED',
        tick: tickCount,
        data: { zoneId, riskLevel: newRisk },
      });
    }
  }

  // --- BLOCK NODES AND EDGES ---
  const blockedZoneIds = new Set<string>();
  for (const [zoneId, zone] of updatedZones) {
    if (zone.riskLevel >= 80) {
      blockedZoneIds.add(zoneId);
    }
  }

  // Block edges connected to critical-risk zones
  for (const [nodeId, nodeEdges] of edges) {
    const nodeZoneId = nodeToZone.get(nodeId);
    for (const edge of nodeEdges) {
      const targetZoneId = nodeToZone.get(edge.to);
      const shouldBlock = (nodeZoneId && blockedZoneIds.has(nodeZoneId)) ||
                          (targetZoneId && blockedZoneIds.has(targetZoneId));

      if (shouldBlock && !edge.blocked) {
        edge.blocked = true;
        eventBus.publish({
          type: 'EDGE_BLOCKED',
          tick: tickCount,
          edgeFrom: edge.from,
          edgeTo: edge.to,
          data: { reason: 'critical_risk' },
        });
      }
    }
  }

  // Emit NODE_BLOCKED for nodes in critical zones
  for (const zoneId of blockedZoneIds) {
    const zone = updatedZones.get(zoneId)!;
    for (const nodeId of zone.nodeIds) {
      eventBus.publish({
        type: 'NODE_BLOCKED',
        tick: tickCount,
        nodeId,
        data: { zoneId, riskLevel: zone.riskLevel },
      });
    }
  }

  return updatedZones;
}
