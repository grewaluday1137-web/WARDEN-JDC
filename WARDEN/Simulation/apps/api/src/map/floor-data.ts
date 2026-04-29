import { GraphNode, MicroZone } from '@crisis/types';

export interface FloorGraph {
  nodes: GraphNode[];
  edges: [string, string][];
  zones: MicroZone[];
}

const DEFAULT_SENSOR = { temperature: 22, smoke: 0, gas: 5, structural: 1 };

export function getFloorGraph(floorId: number): FloorGraph {
  switch (floorId) {
    case 1: // Ground Floor (F1_GROUND)
      return {
        nodes: [
          { id: 'F1_GROUND_N1',  zoneId: 'lobby',          parentZone: 'B', x: 50, y: 40, type: 'hub' },
          { id: 'F1_GROUND_N2',  zoneId: 'reception',      parentZone: 'D', x: 50, y: 65, type: 'hub' },
          { id: 'F1_GROUND_N6',  zoneId: 'main-entrance',  parentZone: 'D', x: 50, y: 85, type: 'hub', isExit: true },
          { id: 'F1_GROUND_N10', zoneId: 'restaurant',     parentZone: 'C', x: 25, y: 65, type: 'room' },
          { id: 'F1_GROUND_N11', zoneId: 'bar',            parentZone: 'A', x: 25, y: 35, type: 'room' },
          { id: 'F1_GROUND_N20', zoneId: 'ballroom',       parentZone: 'B', x: 75, y: 35, type: 'room' },
          { id: 'F1_GROUND_N21', zoneId: 'pre-function',   parentZone: 'B', x: 75, y: 45, type: 'room' },
          { id: 'F1_GROUND_N30', zoneId: 'kitchen',        parentZone: 'B', x: 75, y: 15, type: 'hazard' },
          { id: 'F1_GROUND_N50', zoneId: 'vertical-stairs-left',    parentZone: 'A', x: 15, y: 50, type: 'hub' },
          { id: 'F1_GROUND_N51', zoneId: 'vertical-stairs-right',   parentZone: 'B', x: 85, y: 50, type: 'hub' },
        ],
        edges: [
          ['F1_GROUND_N6', 'F1_GROUND_N2'], ['F1_GROUND_N2', 'F1_GROUND_N1'], ['F1_GROUND_N1', 'F1_GROUND_N50'], ['F1_GROUND_N1', 'F1_GROUND_N51'],
          ['F1_GROUND_N50', 'F1_GROUND_N10'], ['F1_GROUND_N10', 'F1_GROUND_N11'], ['F1_GROUND_N51', 'F1_GROUND_N20'], ['F1_GROUND_N20', 'F1_GROUND_N21'],
          ['F1_GROUND_N20', 'F1_GROUND_N30']
        ],
        zones: [
          { id: 'lobby', label: 'Lobby', type: 'core', parentZone: 'B', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F1_GROUND_N1'] },
          { id: 'reception', label: 'Reception', type: 'core', parentZone: 'D', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F1_GROUND_N2'] },
          { id: 'main-entrance', label: 'Entrance', type: 'public', parentZone: 'D', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F1_GROUND_N6'] },
          { id: 'restaurant', label: 'Restaurant', type: 'public', parentZone: 'C', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F1_GROUND_N10'] },
          { id: 'ballroom', label: 'Ballroom', type: 'public', parentZone: 'B', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F1_GROUND_N20'] },
          { id: 'kitchen', label: 'Kitchen', type: 'hazard', parentZone: 'B', riskLevel: 0, sensorData: { temperature: 30, smoke: 0, gas: 10, structural: 1 }, nodeIds: ['F1_GROUND_N30'] },
          { id: 'vertical-stairs-left', label: 'West Stairs', type: 'core', parentZone: 'A', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F1_GROUND_N50'] },
          { id: 'vertical-stairs-right', label: 'East Stairs', type: 'core', parentZone: 'B', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F1_GROUND_N51'] },
        ]
      };
    case 2: // First Floor
      return {
        nodes: [
          { id: 'F2_FIRST_N1', zoneId: 'classroom-101', parentZone: 'A', x: 10, y: 10, type: 'room' },
          { id: 'F2_FIRST_N2', zoneId: 'classroom-102', parentZone: 'B', x: 80, y: 10, type: 'room' },
          { id: 'F2_FIRST_N3', zoneId: 'corridor-a',     parentZone: 'D', x: 50, y: 50, type: 'corridor' },
          { id: 'F2_FIRST_N4', zoneId: 'vertical-stairs-left',   parentZone: 'A', x: 15, y: 50, type: 'hub' },
          { id: 'F2_FIRST_N5', zoneId: 'vertical-stairs-right',   parentZone: 'B', x: 85, y: 50, type: 'hub' },
          { id: 'F2_FIRST_N6', zoneId: 'exit-emergency', parentZone: 'D', x: 50, y: 90, type: 'hub', isExit: true },
          { id: 'F2_FIRST_N7', zoneId: 'restroom-west',  parentZone: 'C', x: 25, y: 75, type: 'room' },
        ],
        edges: [
          ['F2_FIRST_N1', 'F2_FIRST_N3'], ['F2_FIRST_N2', 'F2_FIRST_N3'], ['F2_FIRST_N3', 'F2_FIRST_N4'], ['F2_FIRST_N3', 'F2_FIRST_N5'],
          ['F2_FIRST_N4', 'F2_FIRST_N6'], ['F2_FIRST_N5', 'F2_FIRST_N6'], ['F2_FIRST_N7', 'F2_FIRST_N3']
        ],
        zones: [
          { id: 'classroom-101', label: 'Classroom 101', type: 'private', parentZone: 'A', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F2_FIRST_N1'] },
          { id: 'classroom-102', label: 'Classroom 102', type: 'private', parentZone: 'B', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F2_FIRST_N2'] },
          { id: 'restroom-west', label: 'Restroom', type: 'public', parentZone: 'C', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F2_FIRST_N7'] },
          { id: 'corridor-a', label: 'Corridor A', type: 'corridor', parentZone: 'D', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F2_FIRST_N3'] },
          { id: 'vertical-stairs-left', label: 'West Stairs', type: 'core', parentZone: 'A', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F2_FIRST_N4'] },
          { id: 'vertical-stairs-right', label: 'East Stairs', type: 'core', parentZone: 'B', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F2_FIRST_N5'] },
        ]
      };
    case 3: // Second Floor
      return {
        nodes: [
          { id: 'F3_SECOND_N1', zoneId: 'classroom-201', parentZone: 'A', x: 10, y: 10,  type: 'room' },
          { id: 'F3_SECOND_N2', zoneId: 'classroom-202', parentZone: 'A', x: 30, y: 30,  type: 'room' },
          { id: 'F3_SECOND_N3', zoneId: 'computer-lab',   parentZone: 'B', x: 90, y: 10,  type: 'critical' },
          { id: 'F3_SECOND_N4', zoneId: 'main-corridor', parentZone: 'D', x: 50, y: 50, type: 'corridor' },
          { id: 'F3_SECOND_N5', zoneId: 'vertical-stairs-left',   parentZone: 'A', x: 15, y: 50, type: 'hub' },
          { id: 'F3_SECOND_N6', zoneId: 'vertical-stairs-right',   parentZone: 'B', x: 85, y: 50, type: 'hub' },
          { id: 'F3_SECOND_N9', zoneId: 'exit-emergency', parentZone: 'D', x: 50, y: 70, type: 'hub', isExit: true },
          { id: 'F3_SECOND_N7', zoneId: 'server-room',    parentZone: 'C', x: 25, y: 75, type: 'critical' },
        ],
        edges: [
          ['F3_SECOND_N1', 'F3_SECOND_N4'], ['F3_SECOND_N2', 'F3_SECOND_N4'], ['F3_SECOND_N3', 'F3_SECOND_N4'], ['F3_SECOND_N4', 'F3_SECOND_N5'],
          ['F3_SECOND_N4', 'F3_SECOND_N6'], ['F3_SECOND_N5', 'F3_SECOND_N9'], ['F3_SECOND_N6', 'F3_SECOND_N9'], ['F3_SECOND_N7', 'F3_SECOND_N4']
        ],
        zones: [
          { id: 'classroom-201', label: 'Classroom 201', type: 'private', parentZone: 'A', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F3_SECOND_N1'] },
          { id: 'computer-lab', label: 'Computer Lab', type: 'critical', parentZone: 'B', riskLevel: 0, sensorData: { temperature: 24, smoke: 0, gas: 3, structural: 1 }, nodeIds: ['F3_SECOND_N3'] },
          { id: 'server-room', label: 'Server Room', type: 'critical', parentZone: 'C', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F3_SECOND_N7'] },
          { id: 'main-corridor', label: 'Main Corridor', type: 'corridor', parentZone: 'D', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F3_SECOND_N4'] },
          { id: 'vertical-stairs-left', label: 'West Stairs', type: 'core', parentZone: 'A', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F3_SECOND_N5'] },
          { id: 'vertical-stairs-right', label: 'East Stairs', type: 'core', parentZone: 'B', riskLevel: 0, sensorData: {...DEFAULT_SENSOR}, nodeIds: ['F3_SECOND_N6'] },
        ]
      };

    default:
      return { nodes: [], edges: [], zones: [] };
  }
}
