import { GraphEdge } from '@crisis/types';
import { GRAPH_NODES } from './nodes';

// Pre-compute distances at module load time for O(1) lookups in biEdge()
const _nodeMap = new Map<string, { x: number; y: number }>(
  GRAPH_NODES.map(n => [n.id, { x: n.x, y: n.y }]),
);

function dist(id1: string, id2: string): number {
  const a = _nodeMap.get(id1)!;
  const b = _nodeMap.get(id2)!;
  return Math.round(Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * 100) / 100;
}

function biEdge(from: string, to: string): GraphEdge[] {
  const w = dist(from, to);
  return [
    { from, to, weight: w, blocked: false },
    { from: to, to: from, weight: w, blocked: false },
  ];
}

export const GRAPH_EDGES: GraphEdge[] = [
  // ── Hub internal (spoke from center to compass sub-nodes) ──────────────────
  ...biEdge('hub-01', 'hub-n'),
  ...biEdge('hub-01', 'hub-ne'),
  ...biEdge('hub-01', 'hub-e'),
  ...biEdge('hub-01', 'hub-se'),
  ...biEdge('hub-01', 'hub-s'),
  ...biEdge('hub-01', 'hub-sw'),
  ...biEdge('hub-01', 'hub-w'),
  ...biEdge('hub-01', 'hub-nw'),
  // Hub ring connections (adjacent sub-nodes)
  ...biEdge('hub-n',  'hub-ne'),
  ...biEdge('hub-ne', 'hub-e'),
  ...biEdge('hub-e',  'hub-se'),
  ...biEdge('hub-se', 'hub-s'),
  ...biEdge('hub-s',  'hub-sw'),
  ...biEdge('hub-sw', 'hub-w'),
  ...biEdge('hub-w',  'hub-nw'),
  ...biEdge('hub-nw', 'hub-n'),

  // ── Hub sub-nodes → Ring (bridge hub to corridor ring) ─────────────────────
  ...biEdge('hub-n',  'ring-n'),
  ...biEdge('hub-ne', 'ring-ne'),
  ...biEdge('hub-e',  'ring-e'),
  ...biEdge('hub-se', 'ring-se'),
  ...biEdge('hub-s',  'ring-s'),
  ...biEdge('hub-sw', 'ring-sw'),
  ...biEdge('hub-w',  'ring-w'),
  ...biEdge('hub-nw', 'ring-nw'),

  // ── Ring corridor (circular, connect adjacent 8 ring nodes) ───────────────
  ...biEdge('ring-n',  'ring-ne'),
  ...biEdge('ring-ne', 'ring-e'),
  ...biEdge('ring-e',  'ring-se'),
  ...biEdge('ring-se', 'ring-s'),
  ...biEdge('ring-s',  'ring-sw'),
  ...biEdge('ring-sw', 'ring-w'),
  ...biEdge('ring-w',  'ring-nw'),
  ...biEdge('ring-nw', 'ring-n'),

  // ── NW Wing — Zone A ───────────────────────────────────────────────────────
  // Ring → dining NW
  ...biEdge('ring-nw', 'dining-nw-01'),
  ...biEdge('dining-nw-01', 'dining-nw-02'),
  // Ring/dining → utility NW
  ...biEdge('ring-nw', 'util-nw-01'),
  ...biEdge('dining-nw-02', 'util-nw-01'),
  // Utility → server room
  ...biEdge('util-nw-01', 'server-01'),
  ...biEdge('server-01', 'server-02'),
  // Ring → corridor spine NW
  ...biEdge('ring-w',  'corr-nw-01'),
  ...biEdge('ring-nw', 'corr-nw-01'),
  ...biEdge('corr-nw-01', 'corr-nw-02'),
  ...biEdge('corr-nw-02', 'corr-nw-03'),
  // Dining → corridor
  ...biEdge('dining-nw-02', 'corr-nw-01'),
  // Server → corridor (emergency path)
  ...biEdge('server-02', 'corr-nw-01'),
  // Corridor → guest rooms NW
  ...biEdge('corr-nw-02', 'room-nw-01'),
  ...biEdge('corr-nw-02', 'room-nw-02'),
  ...biEdge('corr-nw-03', 'room-nw-03'),
  ...biEdge('corr-nw-03', 'room-nw-04'),
  // Room adjacency within NW
  ...biEdge('room-nw-01', 'room-nw-02'),
  ...biEdge('room-nw-02', 'room-nw-03'),
  ...biEdge('room-nw-03', 'room-nw-04'),
  // Exits NW
  ...biEdge('server-01',  'exit-nw'),
  ...biEdge('corr-nw-01', 'exit-nw'),
  ...biEdge('ring-n',     'exit-north'),
  ...biEdge('ring-w',     'exit-west'),

  // ── NE Wing — Zone B ───────────────────────────────────────────────────────
  // Ring → pool
  ...biEdge('ring-ne', 'pool-01'),
  ...biEdge('pool-01', 'pool-02'),
  // Ring/pool → utility NE
  ...biEdge('ring-ne', 'util-ne-01'),
  ...biEdge('pool-02', 'util-ne-01'),
  // Ring → dining NE
  ...biEdge('ring-ne', 'dining-ne-01'),
  ...biEdge('ring-e',  'dining-ne-01'),
  ...biEdge('dining-ne-01', 'dining-ne-02'),
  // Ring → corridor spine NE
  ...biEdge('ring-e',  'corr-ne-01'),
  ...biEdge('ring-ne', 'corr-ne-01'),
  ...biEdge('corr-ne-01', 'corr-ne-02'),
  ...biEdge('corr-ne-02', 'corr-ne-03'),
  // Dining → corridor
  ...biEdge('dining-ne-02', 'corr-ne-01'),
  // Pool/utility → corridor (emergency path)
  ...biEdge('util-ne-01', 'corr-ne-01'),
  // Corridor → guest rooms NE
  ...biEdge('corr-ne-02', 'room-ne-01'),
  ...biEdge('corr-ne-02', 'room-ne-02'),
  ...biEdge('corr-ne-03', 'room-ne-03'),
  ...biEdge('corr-ne-03', 'room-ne-04'),
  // Room adjacency within NE
  ...biEdge('room-ne-01', 'room-ne-02'),
  ...biEdge('room-ne-02', 'room-ne-03'),
  ...biEdge('room-ne-03', 'room-ne-04'),
  // Exits NE
  ...biEdge('pool-02',    'exit-ne'),
  ...biEdge('corr-ne-01', 'exit-ne'),
  ...biEdge('ring-e',     'exit-east'),

  // ── SW Wing — Zone C ───────────────────────────────────────────────────────
  // Ring → lounge SW
  ...biEdge('ring-sw', 'lounge-sw-01'),
  ...biEdge('ring-s',  'lounge-sw-01'),
  ...biEdge('lounge-sw-01', 'lounge-sw-02'),
  // Lounge/ring → corridor SW
  ...biEdge('ring-sw',     'corr-sw-01'),
  ...biEdge('lounge-sw-02', 'corr-sw-01'),
  ...biEdge('corr-sw-01',  'corr-sw-02'),
  // Corridor NW → corridor SW (left wing spine connects top-to-bottom)
  ...biEdge('corr-nw-03', 'lounge-sw-01'),
  // Corridor → guest rooms SW
  ...biEdge('corr-sw-01', 'room-sw-01'),
  ...biEdge('corr-sw-01', 'room-sw-03'),
  ...biEdge('corr-sw-02', 'room-sw-02'),
  ...biEdge('corr-sw-02', 'room-sw-04'),
  // Room adjacency SW
  ...biEdge('room-sw-01', 'room-sw-02'),
  ...biEdge('room-sw-02', 'room-sw-03'),
  ...biEdge('room-sw-03', 'room-sw-04'),
  // Exits SW
  ...biEdge('corr-sw-01', 'exit-sw'),
  ...biEdge('room-sw-01', 'exit-sw'),
  ...biEdge('ring-s',     'exit-south'),
  ...biEdge('ring-sw',    'exit-west'),   // secondary west exit path

  // ── SE Wing — Zone D ───────────────────────────────────────────────────────
  // Ring → lounge SE
  ...biEdge('ring-se', 'lounge-se-01'),
  ...biEdge('ring-s',  'lounge-se-02'),
  ...biEdge('lounge-se-01', 'lounge-se-02'),
  // Lounge/ring → corridor SE
  ...biEdge('ring-se',     'corr-se-01'),
  ...biEdge('lounge-se-01', 'corr-se-01'),
  ...biEdge('corr-se-01',  'corr-se-02'),
  // Corridor NE → corridor SE (right wing spine connects top-to-bottom)
  ...biEdge('corr-ne-03', 'lounge-se-01'),
  // Corridor → guest rooms SE
  ...biEdge('corr-se-01', 'room-se-01'),
  ...biEdge('corr-se-01', 'room-se-03'),
  ...biEdge('corr-se-02', 'room-se-02'),
  ...biEdge('corr-se-02', 'room-se-04'),
  // Room adjacency SE
  ...biEdge('room-se-01', 'room-se-02'),
  ...biEdge('room-se-02', 'room-se-03'),
  ...biEdge('room-se-03', 'room-se-04'),
  // Exits SE
  ...biEdge('corr-se-01', 'exit-se'),
  ...biEdge('room-se-01', 'exit-se'),
  ...biEdge('ring-e',     'exit-east'),   // secondary path (already defined, no duplicate object issue)
];
