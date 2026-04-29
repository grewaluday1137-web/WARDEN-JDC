import { GraphNode, GraphEdge, MicroZone } from '@crisis/types';

// ─── Min-Heap Priority Queue ───────────────────────────────────────────────────

/**
 * Min-heap priority queue for A* open set.
 * Maintains the heap invariant: parent.priority <= child.priority
 */
class MinHeap {
  private heap: { nodeId: string; priority: number }[] = [];

  push(nodeId: string, priority: number): void {
    this.heap.push({ nodeId, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { nodeId: string; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.heap[parent].priority <= this.heap[index].priority) break;
      // Swap with parent
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const left = (index << 1) + 1;
      const right = left + 1;
      let smallest = index;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      if (smallest === index) break;
      [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
      index = smallest;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Euclidean distance heuristic between two nodes.
 */
function heuristic(a: GraphNode, b: GraphNode): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Get the micro-zone a node belongs to.
 */
function getNodeZone(
  nodeId: string,
  nodes: Map<string, GraphNode>,
  zones: Map<string, MicroZone>
): MicroZone | undefined {
  const node = nodes.get(nodeId);
  if (!node) return undefined;
  return zones.get(node.zoneId);
}

// ─── Core Pathfinding ─────────────────────────────────────────────────────────

/**
 * A* pathfinding from startNode to endNode.
 *
 * - Skips nodes where zone riskLevel >= 80 (critical), unless it is the destination
 * - Skips blocked edges
 * - Edge cost = edge.weight * (1 + zone.riskLevel / 100) for risk-adjusted routing
 * - Returns ordered array of node IDs from start to end, or null if no path exists
 *
 * @param startNode  - ID of the origin graph node
 * @param endNode    - ID of the destination graph node
 * @param nodes      - Map of all graph nodes keyed by ID
 * @param edges      - Adjacency map: nodeId → outgoing GraphEdge[]
 * @param zones      - Map of all micro-zones keyed by zone ID
 * @param options    - Optional routing modifiers
 * @param options.avoidDangerous - If true, also avoid nodes with risk >= 60
 * @param options.invertRisk     - If true, prefer dangerous areas (for responders)
 */
export function findPath(
  startNode: string,
  endNode: string,
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge[]>,
  zones: Map<string, MicroZone>,
  options?: {
    avoidDangerous?: boolean;
    invertRisk?: boolean;
  }
): string[] | null {
  const start = nodes.get(startNode);
  const end = nodes.get(endNode);
  if (!start || !end) return null;

  // Trivial case
  if (startNode === endNode) return [startNode];

  const openSet = new MinHeap();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const closedSet = new Set<string>();

  gScore.set(startNode, 0);
  openSet.push(startNode, heuristic(start, end));

  while (openSet.size > 0) {
    const current = openSet.pop()!;

    // Reached destination — reconstruct path
    if (current.nodeId === endNode) {
      const path: string[] = [];
      let node: string | undefined = endNode;
      while (node !== undefined) {
        path.unshift(node);
        node = cameFrom.get(node);
      }
      return path;
    }

    // Skip already-processed nodes (stale heap entries)
    if (closedSet.has(current.nodeId)) continue;
    closedSet.add(current.nodeId);

    const neighbors = edges.get(current.nodeId) ?? [];
    for (const edge of neighbors) {
      if (edge.blocked) continue;
      if (closedSet.has(edge.to)) continue;

      const neighborZone = getNodeZone(edge.to, nodes, zones);
      const risk = neighborZone?.riskLevel ?? 0;

      // Skip critical-risk nodes (>= 80) unless destination
      if (risk >= 80 && edge.to !== endNode) continue;

      // Optionally skip dangerous nodes (>= 60) unless destination
      if (options?.avoidDangerous && risk >= 60 && edge.to !== endNode) continue;

      // Risk-adjusted traversal cost
      let riskMultiplier: number;
      if (options?.invertRisk) {
        // Responder mode: lower cost for higher-risk areas (they head into danger)
        riskMultiplier = 1 + (100 - risk) / 100;
      } else {
        // Standard mode: higher cost for higher-risk areas (prefer safe routes)
        riskMultiplier = 1 + risk / 100;
      }

      const moveCost = edge.weight * riskMultiplier;
      const tentativeG = (gScore.get(current.nodeId) ?? Infinity) + moveCost;

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, current.nodeId);
        gScore.set(edge.to, tentativeG);

        const neighbor = nodes.get(edge.to);
        if (!neighbor) continue;

        const fScore = tentativeG + heuristic(neighbor, end);
        openSet.push(edge.to, fScore);
      }
    }
  }

  return null; // No path found
}

// ─── Nearest Exit ─────────────────────────────────────────────────────────────

/**
 * Find a path to the nearest exit node from startNode.
 *
 * Tries all exit nodes in the graph and returns the shortest valid path by
 * raw edge-weight cost (not risk-adjusted), so the result reflects true
 * physical distance to the closest reachable exit.
 *
 * @param startNode - ID of the origin graph node
 * @param nodes     - Map of all graph nodes keyed by ID
 * @param edges     - Adjacency map: nodeId → outgoing GraphEdge[]
 * @param zones     - Map of all micro-zones keyed by zone ID
 * @param options   - Optional routing modifiers (passed through to findPath)
 */
export function findNearestExit(
  startNode: string,
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge[]>,
  zones: Map<string, MicroZone>,
  options?: { avoidDangerous?: boolean; invertRisk?: boolean }
): string[] | null {
  const exitNodes = Array.from(nodes.values()).filter(n => n.isExit === true);

  let bestPath: string[] | null = null;
  let bestCost = Infinity;

  for (const exit of exitNodes) {
    if (exit.id === startNode) {
      // Already at an exit — zero cost, return immediately
      return [startNode];
    }

    const path = findPath(startNode, exit.id, nodes, edges, zones, options);
    if (!path) continue;

    // Compute raw edge-weight cost along this path (unaffected by risk multiplier)
    let cost = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const nodeEdges = edges.get(path[i]) ?? [];
      const edge = nodeEdges.find(e => e.to === path[i + 1]);
      if (edge) cost += edge.weight;
    }

    if (cost < bestCost) {
      bestCost = cost;
      bestPath = path;
    }
  }

  return bestPath;
}

// ─── Path Validation Utilities ────────────────────────────────────────────────

/**
 * Check whether every node in the path has a zone risk below the threshold.
 *
 * @param path      - Ordered array of node IDs
 * @param nodes     - Map of all graph nodes keyed by ID
 * @param zones     - Map of all micro-zones keyed by zone ID
 * @param threshold - Risk level at or above which the path is deemed unsafe (default 60)
 * @returns true if all nodes are below the threshold, false if any node meets or exceeds it
 */
export function isPathSafe(
  path: string[],
  nodes: Map<string, GraphNode>,
  zones: Map<string, MicroZone>,
  threshold: number = 60
): boolean {
  for (const nodeId of path) {
    const zone = getNodeZone(nodeId, nodes, zones);
    if (zone && zone.riskLevel >= threshold) return false;
  }
  return true;
}

/**
 * Check whether every consecutive edge in the path is present and unblocked.
 *
 * @param path  - Ordered array of node IDs
 * @param edges - Adjacency map: nodeId → outgoing GraphEdge[]
 * @returns true if the entire path is traversable, false if any edge is missing or blocked
 */
export function isPathTraversable(
  path: string[],
  edges: Map<string, GraphEdge[]>
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const nodeEdges = edges.get(path[i]) ?? [];
    const edge = nodeEdges.find(e => e.to === path[i + 1]);
    if (!edge || edge.blocked) return false;
  }
  return true;
}
