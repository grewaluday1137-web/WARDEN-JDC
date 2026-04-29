import { GraphNode, GraphEdge, MicroZone, GraphState, Zone, SimEntity } from '@crisis/types';

// ─── GraphData ────────────────────────────────────────────────────────────────

/** In-memory graph structure with O(1) lookups for all hot paths */
export interface GraphData {
  /** All graph nodes keyed by node ID */
  nodes: Map<string, GraphNode>;
  /** Adjacency list: source node ID → outgoing edges */
  edges: Map<string, GraphEdge[]>;
  /** All micro-zones keyed by zone ID */
  zones: Map<string, MicroZone>;
}

import { getFloorGraph } from './floor-data';

/**
 * Constructs the full facility graph for a specific floor.
 * - Populates zone.nodeIds for every micro-zone.
 */
export function buildGraph(floorId: number = 1): GraphData {
  const floorGraph = getFloorGraph(floorId);

  const nodes = new Map<string, GraphNode>();
  for (const n of floorGraph.nodes) {
    nodes.set(n.id, { ...n, floor: floorId } as any);
  }

  const edges = new Map<string, GraphEdge[]>();
  for (const [from, to] of floorGraph.edges) {
    if (!edges.has(from)) edges.set(from, []);
    edges.get(from)!.push({ from, to, weight: 1, blocked: false });
    
    // Also add reverse for bidirectional simulation
    if (!edges.has(to)) edges.set(to, []);
    edges.get(to)!.push({ from: to, to: from, weight: 1, blocked: false });
  }

  const zones = new Map<string, MicroZone>();
  for (const z of floorGraph.zones) {
    zones.set(z.id, { ...z });
  }

  return { nodes, edges, zones };
}


// ─── Lookup Utilities ─────────────────────────────────────────────────────────

/**
 * Returns all nodes whose parentZone matches the given macro-zone (A/B/C/D).
 */
export function getNodesByZone(graph: GraphData, parentZone: Zone): GraphNode[] {
  const result: GraphNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.parentZone === parentZone) result.push(node);
  }
  return result;
}

/**
 * Returns IDs of all nodes reachable in one hop from nodeId via unblocked edges.
 */
export function getAdjacentNodes(graph: GraphData, nodeId: string): string[] {
  const edgeList = graph.edges.get(nodeId);
  if (!edgeList) return [];
  return edgeList.filter(e => !e.blocked).map(e => e.to);
}

/**
 * Returns the edge weight between two directly connected nodes.
 * Returns Infinity if no direct edge exists or the edge is blocked.
 */
export function getNodeDistance(graph: GraphData, a: string, b: string): number {
  const edgeList = graph.edges.get(a);
  if (!edgeList) return Infinity;
  const edge = edgeList.find(e => e.to === b);
  if (!edge || edge.blocked) return Infinity;
  return edge.weight;
}

/**
 * Returns all nodes marked as exits (isExit === true).
 */
export function getExitNodes(graph: GraphData): GraphNode[] {
  const exits: GraphNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.isExit) exits.push(node);
  }
  return exits;
}

/**
 * Finds the nearest graph node to an arbitrary (x, y) coordinate using
 * Euclidean distance. Used to snap BLE/CV positions to the graph.
 */
export function findNearestNode(graph: GraphData, x: number, y: number): GraphNode {
  let nearest: GraphNode | undefined;
  let minDist = Infinity;
  for (const node of graph.nodes.values()) {
    const d = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
    if (d < minDist) {
      minDist = d;
      nearest = node;
    }
  }
  // graph always has ≥1 node, so nearest is always defined
  return nearest!;
}

/**
 * Returns the micro-zone that owns a given node.
 * Returns undefined if the node is not found or has no zone.
 */
export function getZoneForNode(graph: GraphData, nodeId: string): MicroZone | undefined {
  const node = graph.nodes.get(nodeId);
  if (!node) return undefined;
  return graph.zones.get(node.zoneId);
}

// ─── cloneGraphState ──────────────────────────────────────────────────────────

/**
 * Creates a fully serializable, deep-copied GraphState snapshot suitable for
 * inclusion in a TickPayload. Bidirectional edges are deduplicated so only
 * the canonical (from < to) direction is sent over the wire.
 */
export function cloneGraphState(graph: GraphData, entities: SimEntity[]): GraphState {
  // Collect all edges from the adjacency list
  const allEdges: GraphEdge[] = [];
  for (const edgeList of graph.edges.values()) {
    for (const e of edgeList) {
      allEdges.push(e);
    }
  }

  // Deduplicate: keep only one direction per pair (prefer from < to)
  const seen = new Set<string>();
  const deduped: GraphEdge[] = [];
  for (const e of allEdges) {
    const key = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({ ...e });
    }
  }

  return {
    nodes: Array.from(graph.nodes.values()).map(n => ({ ...n })),
    edges: deduped,
    zones: Array.from(graph.zones.values()).map(z => ({
      ...z,
      sensorData: { ...z.sensorData },
      nodeIds: [...z.nodeIds],
    })),
    entities: entities.map(e => ({ ...e, path: [...e.path] })),
  };
}
