// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Cellular Automata Engine
// Grid-based smoke, heat, and gas propagation using cellular automata rules
// ═══════════════════════════════════════════════════════════════════════════════

import type { CACell, CAGridState, Zone } from '../types';

const GRID_SIZE = 20; // 20×20 grid over the 100×100 coordinate space
const CELL_SIZE = 100 / GRID_SIZE; // Each cell covers 5×5 units

// Diffusion coefficients (how much spreads per tick)
const HEAT_DIFFUSION = 0.08;
const SMOKE_DIFFUSION = 0.12;  // Smoke spreads faster than heat
const GAS_DIFFUSION = 0.15;    // Gas spreads fastest

// Decay per tick (natural dissipation)
const HEAT_DECAY = 0.005;
const SMOKE_DECAY = 0.01;
const GAS_DECAY = 0.008;

// Ambient values
const AMBIENT_TEMP = 22;

function createEmptyGrid(): CACell[][] {
  const grid: CACell[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[y][x] = {
        temperature: AMBIENT_TEMP,
        smoke: 0,
        gas: 0,
        blocked: false,
      };
    }
  }
  return grid;
}

/**
 * Von Neumann neighborhood: 4 cardinal neighbors
 */
function getNeighbors(x: number, y: number): [number, number][] {
  const neighbors: [number, number][] = [];
  if (x > 0) neighbors.push([x - 1, y]);
  if (x < GRID_SIZE - 1) neighbors.push([x + 1, y]);
  if (y > 0) neighbors.push([x, y - 1]);
  if (y < GRID_SIZE - 1) neighbors.push([x, y + 1]);
  return neighbors;
}

/**
 * Map a (0-100) coordinate to grid cell index
 */
function coordToCell(coord: number): number {
  return Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(coord / CELL_SIZE)));
}

/**
 * Determine which macro-zone (A/B/C/D) a grid cell belongs to
 */
function cellToZone(cx: number, cy: number): Zone {
  const midpoint = GRID_SIZE / 2;
  if (cx < midpoint && cy < midpoint) return 'A';
  if (cx >= midpoint && cy < midpoint) return 'B';
  if (cx < midpoint && cy >= midpoint) return 'C';
  return 'D';
}

export class CellularAutomataEngine {
  private grid: CACell[][];
  private tickCount = 0;
  private floorId: number;

  constructor(floorId: number = 1) {
    this.floorId = floorId;
    this.grid = createEmptyGrid();
  }

  /**
   * Inject an incident at a specific location.
   * Marks the cell and its immediate area as having high temp/smoke/gas.
   */
  injectIncident(x: number, y: number, type: string): void {
    const cx = coordToCell(x);
    const cy = coordToCell(y);

    switch (type) {
      case 'fire':
      case 'explosion':
        this.grid[cy][cx].temperature = Math.max(this.grid[cy][cx].temperature, 200);
        this.grid[cy][cx].smoke = Math.max(this.grid[cy][cx].smoke, 80);
        break;
      case 'gas_leak':
        this.grid[cy][cx].gas = Math.max(this.grid[cy][cx].gas, 300);
        break;
      case 'structural_collapse':
        this.grid[cy][cx].blocked = true;
        this.grid[cy][cx].smoke = Math.max(this.grid[cy][cx].smoke, 50);
        break;
      default:
        // Other incident types: mild smoke
        this.grid[cy][cx].smoke = Math.max(this.grid[cy][cx].smoke, 30);
    }
  }

  /**
   * One simulation step. Applies diffusion and decay rules.
   * Uses a double-buffer approach (reads from old grid, writes to new grid).
   */
  tick(): void {
    this.tickCount++;
    const newGrid = createEmptyGrid();

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.grid[y][x];

        // Carry forward blocked state
        newGrid[y][x].blocked = cell.blocked;

        if (cell.blocked) {
          // Blocked cells retain their values but don't propagate
          newGrid[y][x].temperature = cell.temperature;
          newGrid[y][x].smoke = cell.smoke;
          newGrid[y][x].gas = cell.gas;
          continue;
        }

        const neighbors = getNeighbors(x, y);
        const unblocked = neighbors.filter(([nx, ny]) => !this.grid[ny][nx].blocked);

        // ─── HEAT DIFFUSION ─────────────────────────────────────────────
        let heatInflow = 0;
        for (const [nx, ny] of unblocked) {
          const neighborTemp = this.grid[ny][nx].temperature;
          const delta = neighborTemp - cell.temperature;
          if (delta > 0) heatInflow += delta * HEAT_DIFFUSION;
        }
        // Apply natural decay towards ambient
        const heatDecay = (cell.temperature - AMBIENT_TEMP) * HEAT_DECAY;
        newGrid[y][x].temperature = Math.max(AMBIENT_TEMP, cell.temperature + heatInflow - heatDecay);

        // ─── SMOKE DIFFUSION ────────────────────────────────────────────
        // Smoke rises: bias upward (lower y index)
        let smokeInflow = 0;
        for (const [nx, ny] of unblocked) {
          const neighborSmoke = this.grid[ny][nx].smoke;
          const delta = neighborSmoke - cell.smoke;
          if (delta > 0) {
            // Extra factor if neighbor is below (higher y = below in our grid)
            const verticalBias = ny > y ? 1.3 : 1.0;
            smokeInflow += delta * SMOKE_DIFFUSION * verticalBias;
          }
        }
        // Generate smoke from high temperatures
        const thermalSmoke = cell.temperature > 60 ? (cell.temperature - 60) * 0.05 : 0;
        newGrid[y][x].smoke = Math.max(0, Math.min(100, cell.smoke + smokeInflow + thermalSmoke - cell.smoke * SMOKE_DECAY));

        // ─── GAS DIFFUSION ──────────────────────────────────────────────
        // Gas spreads uniformly (heavier-than-air bias: sinks)
        let gasInflow = 0;
        for (const [nx, ny] of unblocked) {
          const neighborGas = this.grid[ny][nx].gas;
          const delta = neighborGas - cell.gas;
          if (delta > 0) {
            const sinkBias = ny < y ? 1.2 : 1.0; // Gas sinks (higher y)
            gasInflow += delta * GAS_DIFFUSION * sinkBias;
          }
        }
        newGrid[y][x].gas = Math.max(0, cell.gas + gasInflow - cell.gas * GAS_DECAY);
      }
    }

    this.grid = newGrid;
  }

  /**
   * Get the current grid state for serialization
   */
  getState(): CAGridState {
    return {
      width: GRID_SIZE,
      height: GRID_SIZE,
      cells: this.grid.map(row => row.map(cell => ({ ...cell }))),
      tick: this.tickCount,
    };
  }

  /**
   * Aggregate CA data by macro-zone.
   * Returns average temperature, smoke, and gas for each zone.
   */
  getZoneAverages(): Record<Zone, { temperature: number; smoke: number; gas: number }> {
    const zones: Record<string, { tempSum: number; smokeSum: number; gasSum: number; count: number }> = {
      A: { tempSum: 0, smokeSum: 0, gasSum: 0, count: 0 },
      B: { tempSum: 0, smokeSum: 0, gasSum: 0, count: 0 },
      C: { tempSum: 0, smokeSum: 0, gasSum: 0, count: 0 },
      D: { tempSum: 0, smokeSum: 0, gasSum: 0, count: 0 },
    };

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const zone = cellToZone(x, y);
        const cell = this.grid[y][x];
        zones[zone].tempSum += cell.temperature;
        zones[zone].smokeSum += cell.smoke;
        zones[zone].gasSum += cell.gas;
        zones[zone].count++;
      }
    }

    const result: Record<string, { temperature: number; smoke: number; gas: number }> = {};
    for (const [z, data] of Object.entries(zones)) {
      result[z] = {
        temperature: Math.round((data.tempSum / data.count) * 10) / 10,
        smoke: Math.round((data.smokeSum / data.count) * 10) / 10,
        gas: Math.round((data.gasSum / data.count) * 10) / 10,
      };
    }
    return result as Record<Zone, { temperature: number; smoke: number; gas: number }>;
  }

  /**
   * Reset the grid to initial state
   */
  reset(): void {
    this.grid = createEmptyGrid();
    this.tickCount = 0;
  }
}
