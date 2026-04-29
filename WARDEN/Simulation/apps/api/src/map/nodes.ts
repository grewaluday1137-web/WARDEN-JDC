import { GraphNode } from '@crisis/types';

// ─── Node Layout Notes ────────────────────────────────────────────────────────
// Coordinate space: 0-100 (x=left→right, y=top→bottom)
// Hub center:  (50, 50)
// Ring radius: ~20 units from hub center
// Wings extend outward from ring to building perimeter
// Zone quadrants: A=NW (x<50,y<50), B=NE (x>50,y<50), C=SW (x<50,y>50), D=SE (x>50,y>50)

export const GRAPH_NODES: GraphNode[] = [
  // ── Hub Core ───────────────────────────────────────────────────────────────
  { id: 'hub-01',  zoneId: 'hub-center', parentZone: 'A', x: 50, y: 50, type: 'hub' },
  { id: 'hub-n',   zoneId: 'hub-center', parentZone: 'A', x: 50, y: 42, type: 'hub' },
  { id: 'hub-ne',  zoneId: 'hub-center', parentZone: 'B', x: 56, y: 44, type: 'hub' },
  { id: 'hub-e',   zoneId: 'hub-center', parentZone: 'B', x: 58, y: 50, type: 'hub' },
  { id: 'hub-se',  zoneId: 'hub-center', parentZone: 'D', x: 56, y: 56, type: 'hub' },
  { id: 'hub-s',   zoneId: 'hub-center', parentZone: 'C', x: 50, y: 58, type: 'hub' },
  { id: 'hub-sw',  zoneId: 'hub-center', parentZone: 'C', x: 44, y: 56, type: 'hub' },
  { id: 'hub-w',   zoneId: 'hub-center', parentZone: 'A', x: 42, y: 50, type: 'hub' },
  { id: 'hub-nw',  zoneId: 'hub-center', parentZone: 'A', x: 44, y: 44, type: 'hub' },

  // ── Ring Corridor Nodes (radius ~20 from center) ───────────────────────────
  // 8 cardinal/intercardinal ring nodes + 4 mid-ring connectors
  { id: 'ring-n',   zoneId: 'ring-north',     parentZone: 'A', x: 50, y: 30, type: 'corridor' },
  { id: 'ring-ne',  zoneId: 'ring-northeast',  parentZone: 'B', x: 64, y: 36, type: 'corridor' },
  { id: 'ring-e',   zoneId: 'ring-east',       parentZone: 'B', x: 70, y: 50, type: 'corridor' },
  { id: 'ring-se',  zoneId: 'ring-southeast',  parentZone: 'D', x: 64, y: 64, type: 'corridor' },
  { id: 'ring-s',   zoneId: 'ring-south',      parentZone: 'C', x: 50, y: 70, type: 'corridor' },
  { id: 'ring-sw',  zoneId: 'ring-southwest',  parentZone: 'C', x: 36, y: 64, type: 'corridor' },
  { id: 'ring-w',   zoneId: 'ring-west',       parentZone: 'A', x: 30, y: 50, type: 'corridor' },
  { id: 'ring-nw',  zoneId: 'ring-northwest',  parentZone: 'A', x: 36, y: 36, type: 'corridor' },

  // ── NW Wing — Zone A ───────────────────────────────────────────────────────
  // Dining area (mid-left, ~x=20-30 y=38-48)
  { id: 'dining-nw-01', zoneId: 'dining-nw', parentZone: 'A', x: 25, y: 42, type: 'room' },
  { id: 'dining-nw-02', zoneId: 'dining-nw', parentZone: 'A', x: 18, y: 42, type: 'room' },

  // Server room (top-left corner)
  { id: 'server-01', zoneId: 'server-room', parentZone: 'A', x: 12, y: 18, type: 'critical' },
  { id: 'server-02', zoneId: 'server-room', parentZone: 'A', x: 20, y: 18, type: 'critical' },

  // Utility NW (between server room and ring)
  { id: 'util-nw-01', zoneId: 'utility-nw', parentZone: 'A', x: 18, y: 28, type: 'hazard' },

  // Wing corridor NW (vertical spine)
  { id: 'corr-nw-01', zoneId: 'corridor-nw', parentZone: 'A', x: 10, y: 36, type: 'corridor' },
  { id: 'corr-nw-02', zoneId: 'corridor-nw', parentZone: 'A', x: 10, y: 48, type: 'corridor' },
  { id: 'corr-nw-03', zoneId: 'corridor-nw', parentZone: 'A', x: 10, y: 60, type: 'corridor' },

  // Guest rooms NW (left side, bottom half of NW wing)
  { id: 'room-nw-01', zoneId: 'rooms-nw-1', parentZone: 'A', x: 5,  y: 55, type: 'room' },
  { id: 'room-nw-02', zoneId: 'rooms-nw-2', parentZone: 'A', x: 5,  y: 63, type: 'room' },
  { id: 'room-nw-03', zoneId: 'rooms-nw-3', parentZone: 'A', x: 5,  y: 71, type: 'room' },
  { id: 'room-nw-04', zoneId: 'rooms-nw-4', parentZone: 'A', x: 5,  y: 79, type: 'room' },

  // ── NE Wing — Zone B ───────────────────────────────────────────────────────
  // Pool area (top-right)
  { id: 'pool-01', zoneId: 'pool', parentZone: 'B', x: 80, y: 20, type: 'room' },
  { id: 'pool-02', zoneId: 'pool', parentZone: 'B', x: 88, y: 20, type: 'room' },

  // Utility NE
  { id: 'util-ne-01', zoneId: 'utility-ne', parentZone: 'B', x: 82, y: 28, type: 'hazard' },

  // Dining area NE (mid-right)
  { id: 'dining-ne-01', zoneId: 'dining-ne', parentZone: 'B', x: 75, y: 42, type: 'room' },
  { id: 'dining-ne-02', zoneId: 'dining-ne', parentZone: 'B', x: 82, y: 42, type: 'room' },

  // Wing corridor NE (vertical spine)
  { id: 'corr-ne-01', zoneId: 'corridor-ne', parentZone: 'B', x: 90, y: 36, type: 'corridor' },
  { id: 'corr-ne-02', zoneId: 'corridor-ne', parentZone: 'B', x: 90, y: 48, type: 'corridor' },
  { id: 'corr-ne-03', zoneId: 'corridor-ne', parentZone: 'B', x: 90, y: 60, type: 'corridor' },

  // Guest rooms NE
  { id: 'room-ne-01', zoneId: 'rooms-ne-1', parentZone: 'B', x: 95, y: 55, type: 'room' },
  { id: 'room-ne-02', zoneId: 'rooms-ne-2', parentZone: 'B', x: 95, y: 63, type: 'room' },
  { id: 'room-ne-03', zoneId: 'rooms-ne-3', parentZone: 'B', x: 95, y: 71, type: 'room' },
  { id: 'room-ne-04', zoneId: 'rooms-ne-4', parentZone: 'B', x: 95, y: 79, type: 'room' },

  // ── SW Wing — Zone C ───────────────────────────────────────────────────────
  // Lounge SW
  { id: 'lounge-sw-01', zoneId: 'lounge-sw', parentZone: 'C', x: 20, y: 62, type: 'room' },
  { id: 'lounge-sw-02', zoneId: 'lounge-sw', parentZone: 'C', x: 28, y: 62, type: 'room' },

  // Wing corridor SW (horizontal spine)
  { id: 'corr-sw-01', zoneId: 'corridor-sw', parentZone: 'C', x: 10, y: 72, type: 'corridor' },
  { id: 'corr-sw-02', zoneId: 'corridor-sw', parentZone: 'C', x: 22, y: 72, type: 'corridor' },

  // Guest rooms SW (two rows)
  { id: 'room-sw-01', zoneId: 'rooms-sw-1', parentZone: 'C', x: 5,  y: 82, type: 'room' },
  { id: 'room-sw-02', zoneId: 'rooms-sw-2', parentZone: 'C', x: 15, y: 82, type: 'room' },
  { id: 'room-sw-03', zoneId: 'rooms-sw-3', parentZone: 'C', x: 5,  y: 90, type: 'room' },
  { id: 'room-sw-04', zoneId: 'rooms-sw-4', parentZone: 'C', x: 15, y: 90, type: 'room' },

  // ── SE Wing — Zone D ───────────────────────────────────────────────────────
  // Lounge SE
  { id: 'lounge-se-01', zoneId: 'lounge-se', parentZone: 'D', x: 80, y: 62, type: 'room' },
  { id: 'lounge-se-02', zoneId: 'lounge-se', parentZone: 'D', x: 72, y: 62, type: 'room' },

  // Wing corridor SE (horizontal spine)
  { id: 'corr-se-01', zoneId: 'corridor-se', parentZone: 'D', x: 90, y: 72, type: 'corridor' },
  { id: 'corr-se-02', zoneId: 'corridor-se', parentZone: 'D', x: 78, y: 72, type: 'corridor' },

  // Guest rooms SE (two rows)
  { id: 'room-se-01', zoneId: 'rooms-se-1', parentZone: 'D', x: 95, y: 82, type: 'room' },
  { id: 'room-se-02', zoneId: 'rooms-se-2', parentZone: 'D', x: 85, y: 82, type: 'room' },
  { id: 'room-se-03', zoneId: 'rooms-se-3', parentZone: 'D', x: 95, y: 90, type: 'room' },
  { id: 'room-se-04', zoneId: 'rooms-se-4', parentZone: 'D', x: 85, y: 90, type: 'room' },

  // ── Exit Nodes (building perimeter) ────────────────────────────────────────
  { id: 'exit-north', zoneId: 'ring-north',     parentZone: 'A', x: 50, y: 2,  type: 'corridor', isExit: true },
  { id: 'exit-east',  zoneId: 'ring-east',      parentZone: 'B', x: 98, y: 50, type: 'corridor', isExit: true },
  { id: 'exit-south', zoneId: 'ring-south',     parentZone: 'C', x: 50, y: 98, type: 'corridor', isExit: true },
  { id: 'exit-west',  zoneId: 'ring-west',      parentZone: 'A', x: 2,  y: 50, type: 'corridor', isExit: true },
  { id: 'exit-nw',    zoneId: 'rooms-nw-1',     parentZone: 'A', x: 2,  y: 18, type: 'corridor', isExit: true },
  { id: 'exit-ne',    zoneId: 'rooms-ne-1',     parentZone: 'B', x: 98, y: 18, type: 'corridor', isExit: true },
  { id: 'exit-sw',    zoneId: 'rooms-sw-1',     parentZone: 'C', x: 2,  y: 88, type: 'corridor', isExit: true },
  { id: 'exit-se',    zoneId: 'rooms-se-1',     parentZone: 'D', x: 98, y: 88, type: 'corridor', isExit: true },
];
