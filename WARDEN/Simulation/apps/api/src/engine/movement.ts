import { SimEntity, GraphNode, GraphEdge, MicroZone, PersonRole } from '@crisis/types';
import { findPath, findNearestExit, isPathSafe, isPathTraversable } from './pathfinding';
import { CrisisEventBus } from '../simulation/eventBus';

/** Movement speed in nodes per tick by entity type */
const SPEED: Record<PersonRole, number> = {
  guest: 1,
  staff: 1,
  responder: 2,
};

/**
 * Move all entities along their paths for one tick.
 * Returns a NEW array of entities (immutable -- does not modify input).
 *
 * Per tick per entity:
 * 1. Skip if idle or no path
 * 2. Check if current path is still safe and traversable
 * 3. If unsafe (risk >= 60 on path) or blocked edge: recalculate path
 * 4. Advance entity along path (1 node for guests/staff, 2 for responders)
 * 5. Update currentNode, trim consumed path segments
 * 6. If entity reached target or exit: update status
 * 7. Emit ENTITY_MOVED event
 */
export function moveEntities(
  entities: SimEntity[],
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge[]>,
  zones: Map<string, MicroZone>,
  eventBus: CrisisEventBus,
  tickCount: number
): SimEntity[] {
  return entities.map(entity => {
    // Deep clone entity for immutability
    const updated: SimEntity = {
      ...entity,
      path: [...entity.path],
    };

    // Skip idle or trapped entities
    if (updated.status === 'idle' || updated.status === 'trapped') {
      return updated;
    }

    // Skip if no path
    if (updated.path.length === 0) {
      return updated;
    }

    // Check if current path is still safe and traversable
    const pathSafe = isPathSafe(updated.path, nodes, zones, 60);
    const pathTraversable = isPathTraversable(updated.path, edges);

    if (!pathSafe || !pathTraversable) {
      // Recalculate path based on entity type
      let newPath: string[] | null = null;

      if (updated.status === 'evacuating') {
        // For evacuating entities, find nearest exit
        newPath = findNearestExit(updated.currentNode, nodes, edges, zones, {
          avoidDangerous: updated.type === 'guest',
          invertRisk: updated.type === 'responder',
        });
      } else if (updated.targetNode) {
        // For moving entities, recalculate to target
        newPath = findPath(updated.currentNode, updated.targetNode, nodes, edges, zones, {
          avoidDangerous: updated.type === 'guest',
          invertRisk: updated.type === 'responder',
        });
      }

      if (newPath && newPath.length > 1) {
        // Remove current node from path start
        updated.path = newPath.slice(1);
        eventBus.publish({
          type: 'PATH_RECALCULATED',
          tick: tickCount,
          entityId: updated.id,
          data: { reason: !pathSafe ? 'unsafe_path' : 'blocked_edge', newPathLength: updated.path.length },
        });
      } else {
        // No valid path -- entity is trapped
        updated.status = 'trapped';
        updated.path = [];
        return updated;
      }
    }

    // Determine movement speed
    const speed = SPEED[updated.type] ?? 1;
    let stepsRemaining = speed;

    while (stepsRemaining > 0 && updated.path.length > 0) {
      const nextNodeId = updated.path[0];

      // Check if next node's zone is safe enough to enter
      const nextNode = nodes.get(nextNodeId);
      if (nextNode) {
        const nextZone = zones.get(nextNode.zoneId);
        if (nextZone) {
          // Guests won't enter dangerous zones
          if (updated.type === 'guest' && nextZone.riskLevel >= 60) {
            break; // Stop moving, will recalculate next tick
          }
          // No one enters critical zones (except responders)
          if (updated.type !== 'responder' && nextZone.riskLevel >= 80) {
            break;
          }
          // Accumulate risk exposure
          updated.riskExposure = Math.min(1, updated.riskExposure + nextZone.riskLevel / 1000);
        }
      }

      // Check edge is not blocked
      const nodeEdges = edges.get(updated.currentNode) ?? [];
      const edge = nodeEdges.find(e => e.to === nextNodeId);
      if (!edge || edge.blocked) {
        break; // Can't move, will recalculate next tick
      }

      // Move to next node
      updated.currentNode = nextNodeId;
      updated.path.shift();
      stepsRemaining--;

      eventBus.publish({
        type: 'ENTITY_MOVED',
        tick: tickCount,
        entityId: updated.id,
        nodeId: nextNodeId,
        data: { previousNode: entity.currentNode, status: updated.status },
      });

      // Check if reached an exit node
      if (nextNode?.isExit && updated.status === 'evacuating') {
        updated.status = 'idle'; // will be marked evacuated by evacuation engine
        updated.path = [];
        eventBus.publish({
          type: 'ENTITY_EVACUATED',
          tick: tickCount,
          entityId: updated.id,
          nodeId: nextNodeId,
        });
        break;
      }
    }

    // If path is empty and still moving, mark as idle
    if (updated.path.length === 0 && updated.status === 'moving') {
      updated.status = 'idle';
    }

    return updated;
  });
}

/**
 * Assign evacuation paths to entities that don't have one yet.
 * Called when evacuation starts or when entities need rerouting.
 */
export function assignEvacuationPaths(
  entities: SimEntity[],
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge[]>,
  zones: Map<string, MicroZone>,
): SimEntity[] {
  return entities.map(entity => {
    if (entity.status !== 'evacuating' && entity.status !== 'idle') {
      return entity;
    }

    // Responders move toward danger instead of exits
    if (entity.type === 'responder') {
      // Find the highest risk zone with trapped entities or high risk
      let targetNode: string | null = null;
      let highestRisk = 0;
      for (const [, zone] of zones) {
        if (zone.riskLevel > highestRisk && zone.riskLevel < 80) {
          highestRisk = zone.riskLevel;
          if (zone.nodeIds.length > 0) {
            targetNode = zone.nodeIds[0];
          }
        }
      }

      if (targetNode) {
        const path = findPath(entity.currentNode, targetNode, nodes, edges, zones, { invertRisk: true });
        if (path && path.length > 1) {
          return {
            ...entity,
            status: 'moving' as const,
            targetNode,
            path: path.slice(1),
          };
        }
      }
      return entity;
    }

    // Guests and staff: find nearest exit
    const exitPath = findNearestExit(entity.currentNode, nodes, edges, zones, {
      avoidDangerous: entity.type === 'guest',
    });

    if (exitPath && exitPath.length > 1) {
      return {
        ...entity,
        status: 'evacuating' as const,
        targetNode: exitPath[exitPath.length - 1],
        path: exitPath.slice(1),
      };
    }

    // No path to exit -- trapped
    return {
      ...entity,
      status: 'trapped' as const,
      path: [],
    };
  });
}
