/**
 * Static floor map data extracted from CrysisDesk MAP JSON files.
 * Each floor has: id, label, image path, nodes, and edges.
 *
 * Node coordinate systems vary per floor — the FloorMap component
 * normalizes them relative to a 1000×700 virtual canvas.
 */

export const FLOORS = [
  {
    id: 1,
    key: 'ground',
    label: 'Ground Floor',
    image: '/maps/ground.png',
    nodes: [
      { id: 'N1',  type: 'open_area', zone: 'lobby',          label: 'Lobby',          x: 500, y: 400, capacity: 50 },
      { id: 'N2',  type: 'open_area', zone: 'reception',      label: 'Reception',      x: 500, y: 460 },
      { id: 'N3',  type: 'junction',  zone: 'lobby',          label: 'Lobby Junction', x: 500, y: 350 },
      { id: 'N4',  type: 'open_area', zone: 'lobby_left',     label: 'Lobby Left',     x: 380, y: 420 },
      { id: 'N5',  type: 'open_area', zone: 'lobby_right',    label: 'Lobby Right',    x: 620, y: 420 },
      { id: 'N6',  type: 'exit',      zone: 'main_entrance',  label: 'Main Entrance',  x: 500, y: 550, isExit: true },
      { id: 'N10', type: 'open_area', zone: 'restaurant',     label: 'Restaurant',     x: 250, y: 450, capacity: 80 },
      { id: 'N11', type: 'open_area', zone: 'bar',            label: 'Bar',            x: 250, y: 350 },
      { id: 'N12', type: 'open_area', zone: 'cafe',           label: 'Café',           x: 150, y: 250 },
      { id: 'N20', type: 'open_area', zone: 'ballroom',       label: 'Ballroom',       x: 750, y: 350, capacity: 120 },
      { id: 'N21', type: 'open_area', zone: 'pre_function',   label: 'Pre-Function',   x: 750, y: 450 },
      { id: 'N30', type: 'service',   zone: 'kitchen',        label: 'Kitchen',        x: 750, y: 150 },
      { id: 'N31', type: 'service',   zone: 'prep_kitchen',   label: 'Prep Kitchen',   x: 850, y: 150 },
      { id: 'N32', type: 'service',   zone: 'dry_store',      label: 'Dry Store',      x: 650, y: 150 },
      { id: 'N33', type: 'service',   zone: 'staff_lounge',   label: 'Staff Lounge',   x: 350, y: 150 },
      { id: 'N34', type: 'service',   zone: 'staff_toilet',   label: 'Staff Toilet',   x: 300, y: 150 },
      { id: 'N35', type: 'service',   zone: 'staff_locker',   label: 'Staff Locker',   x: 250, y: 150 },
      { id: 'N40', type: 'service',   zone: 'receiving',      label: 'Receiving',      x: 200, y: 600, isExit: true },
      { id: 'N41', type: 'service',   zone: 'linen',          label: 'Linen',          x: 350, y: 600 },
      { id: 'N42', type: 'service',   zone: 'housekeeping',   label: 'Housekeeping',   x: 600, y: 600, isExit: true },
      { id: 'N43', type: 'service',   zone: 'engineering',    label: 'Engineering',    x: 700, y: 600 },
      { id: 'N44', type: 'service',   zone: 'security',       label: 'Security',       x: 780, y: 600 },
      { id: 'N45', type: 'service',   zone: 'admin',          label: 'Admin',          x: 850, y: 600 },
      { id: 'N50', type: 'vertical',  zone: 'stairs_left',    label: 'Stairs Left',    x: 400, y: 300 },
      { id: 'N51', type: 'vertical',  zone: 'stairs_right',   label: 'Stairs Right',   x: 600, y: 300 },
      { id: 'N52', type: 'vertical',  zone: 'lift_main',      label: 'Lift Main',      x: 500, y: 200 },
      { id: 'N53', type: 'vertical',  zone: 'service_lift',   label: 'Service Lift',   x: 650, y: 200 },
    ],
    edges: [
      ['N6','N2'], ['N2','N1'], ['N1','N3'], ['N3','N4'], ['N3','N5'],
      ['N4','N10'], ['N10','N11'], ['N11','N12'],
      ['N5','N20'], ['N20','N21'],
      ['N3','N50'], ['N3','N51'], ['N3','N52'],
      ['N52','N30'], ['N30','N31'], ['N30','N32'],
      ['N33','N3'], ['N40','N6'], ['N42','N6'],
    ],
    // Virtual canvas the node coords are authored against
    canvasW: 1000,
    canvasH: 700,
  },

  {
    id: 2,
    key: 'first',
    label: 'First Floor',
    image: '/maps/first.png',
    nodes: [
      { id: 'N1', type: 'room',     zone: 'classroom_101', label: 'Classroom 101', x: 100, y: 100, capacity: 40 },
      { id: 'N2', type: 'room',     zone: 'classroom_102', label: 'Classroom 102', x: 300, y: 100, capacity: 40 },
      { id: 'N3', type: 'corridor', zone: 'corridor_a',    label: 'Corridor A',    x: 200, y: 200, capacity: 100 },
      { id: 'N4', type: 'stairs',   zone: 'staircase_1',   label: 'Staircase 1',   x: 100, y: 300 },
      { id: 'N5', type: 'stairs',   zone: 'staircase_2',   label: 'Staircase 2',   x: 300, y: 300 },
      { id: 'N6', type: 'exit',     zone: 'emergency_exit', label: 'Emergency Exit', x: 200, y: 400, isExit: true },
      { id: 'N7', type: 'washroom', zone: 'washroom',      label: 'Washroom',      x: 400, y: 200 },
      { id: 'N8', type: 'office',   zone: 'faculty_room',  label: 'Faculty Room',  x: 500, y: 100 },
    ],
    edges: [
      ['N1','N3'], ['N2','N3'], ['N3','N4'], ['N3','N5'],
      ['N4','N6'], ['N5','N6'], ['N3','N7'], ['N7','N8'],
    ],
    canvasW: 600,
    canvasH: 500,
  },

  {
    id: 3,
    key: 'second',
    label: 'Second Floor',
    image: '/maps/second.png',
    nodes: [
      { id: 'N1', type: 'room',     zone: 'classroom_201', label: 'Classroom 201', x: 120, y: 90,  capacity: 40 },
      { id: 'N2', type: 'room',     zone: 'classroom_202', label: 'Classroom 202', x: 300, y: 90,  capacity: 40 },
      { id: 'N3', type: 'lab',      zone: 'computer_lab',  label: 'Computer Lab',  x: 480, y: 90,  capacity: 50 },
      { id: 'N4', type: 'corridor', zone: 'main_corridor', label: 'Main Corridor', x: 300, y: 200, capacity: 120 },
      { id: 'N5', type: 'stairs',   zone: 'staircase_a',   label: 'Staircase A',   x: 120, y: 320 },
      { id: 'N6', type: 'stairs',   zone: 'staircase_b',   label: 'Staircase B',   x: 480, y: 320 },
      { id: 'N7', type: 'washroom', zone: 'washroom',       label: 'Washroom',      x: 600, y: 200 },
      { id: 'N8', type: 'office',   zone: 'faculty_cabin', label: 'Faculty Cabin', x: 720, y: 90 },
      { id: 'N9', type: 'exit',     zone: 'emergency_exit', label: 'Emergency Exit', x: 300, y: 420, isExit: true },
    ],
    edges: [
      ['N1','N4'], ['N2','N4'], ['N3','N4'], ['N4','N5'], ['N4','N6'],
      ['N5','N9'], ['N6','N9'], ['N4','N7'], ['N7','N8'],
    ],
    canvasW: 800,
    canvasH: 500,
  },
];

/**
 * Map a floor number from alert.location.floor to a FLOORS entry.
 * Ground = 0, First = 1, Second = 2.
 */
export function getFloorById(floorNum) {
  if (floorNum == null) return null;
  return FLOORS.find((f) => f.id === Number(floorNum)) ?? null;
}
