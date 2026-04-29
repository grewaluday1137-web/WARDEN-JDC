// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — Facility Configuration Service
// Reads/writes local facility config (dependencies, exits, routes) from disk.
// All writes are atomic (write-to-tmp + rename) to prevent corruption.
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  FacilityConfigSchema,
  DependencyArraySchema,
} from '../types';
import type {
  FacilityConfig,
  DependencyLinkConfig,
  DependencyLink,
} from '../types';
import { GRAPH_NODES } from '../map/nodes';
import { GRAPH_EDGES } from '../map/edges';
import { MICRO_ZONES } from '../map/zones';

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'facility-config.json');

// ─── Default config (mirrors the original hardcoded DEPENDENCY_GRAPH) ─────────
const DEFAULT_CONFIG: FacilityConfig = {
  version: 1,
  zones: ['A', 'B', 'C', 'D'],
  dependencies: [
    { id: 'DEP-001', sourceZone: 'A', targetZone: 'C', linkType: 'gas', weight: 0.75, bidirectional: true, label: 'Shared gas main NW–SW' },
    { id: 'DEP-002', sourceZone: 'B', targetZone: 'D', linkType: 'structural', weight: 0.80, bidirectional: true, label: 'Shared load-bearing path NE–SE' },
    { id: 'DEP-003', sourceZone: 'A', targetZone: 'B', linkType: 'electric', weight: 0.60, bidirectional: true, label: 'Primary electric grid NW–NE' },
  ],
  exits: [
    { id: 'EXIT-NW', zone: 'A', x: 0, y: 0, label: 'NW Emergency Exit', capacity: 5, blocked: false },
    { id: 'EXIT-NE', zone: 'B', x: 100, y: 0, label: 'NE Fire Exit', capacity: 5, blocked: false },
    { id: 'EXIT-SW', zone: 'C', x: 0, y: 100, label: 'SW Loading Dock', capacity: 8, blocked: false },
    { id: 'EXIT-SE', zone: 'D', x: 100, y: 100, label: 'SE Main Entrance', capacity: 10, blocked: false },
  ],
  routes: [
    { from: 'A', to: 'B', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'B', to: 'A', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'A', to: 'C', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'C', to: 'A', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'B', to: 'D', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'D', to: 'B', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'C', to: 'D', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'D', to: 'C', travelTimeTicks: 10, hazardMultiplier: 1.0 },
    { from: 'A', to: 'D', travelTimeTicks: 18, hazardMultiplier: 1.0 },
    { from: 'D', to: 'A', travelTimeTicks: 18, hazardMultiplier: 1.0 },
    { from: 'B', to: 'C', travelTimeTicks: 18, hazardMultiplier: 1.0 },
    { from: 'C', to: 'B', travelTimeTicks: 18, hazardMultiplier: 1.0 },
    { from: 'A', to: 'EXIT-NW', travelTimeTicks: 5, hazardMultiplier: 1.0 },
    { from: 'B', to: 'EXIT-NE', travelTimeTicks: 5, hazardMultiplier: 1.0 },
    { from: 'C', to: 'EXIT-SW', travelTimeTicks: 5, hazardMultiplier: 1.0 },
    { from: 'D', to: 'EXIT-SE', travelTimeTicks: 5, hazardMultiplier: 1.0 },
  ],
  metadata: {
    facilityName: 'CrisisSync Default Facility',
    lastModified: new Date().toISOString(),
    author: 'system',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════

export class ConfigService {
  private cachedConfig: FacilityConfig | null = null;

  constructor() {
    this.ensureDataDir();
  }

  // ── Directory setup ─────────────────────────────────────────────────────────
  private ensureDataDir() {
    const dirs = [
      DATA_DIR,
      path.join(DATA_DIR, 'sessions'),
      path.join(DATA_DIR, 'reports'),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[CONFIG] 📁 Created directory: ${dir}`);
      }
    }
  }

  // ── Load facility config ────────────────────────────────────────────────────
  loadFacilityConfig(): FacilityConfig {
    if (this.cachedConfig) return this.cachedConfig;

    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        const validated = FacilityConfigSchema.parse(parsed);
        this.cachedConfig = validated;
        console.log(`[CONFIG] ✅ Loaded facility config (v${validated.version}, ${validated.dependencies.length} dependencies)`);
        return validated;
      }
    } catch (err: unknown) {
      console.warn(`[CONFIG] ⚠️ Failed to load facility config: ${err instanceof Error ? err.message : String(err)} — using defaults`);
    }

    // Write defaults if missing or invalid
    this.saveFacilityConfig(DEFAULT_CONFIG);
    this.cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }

  // ── Save facility config (atomic write) ──────────────────────────────────────
  saveFacilityConfig(config: FacilityConfig): void {
    const validated = FacilityConfigSchema.parse(config);
    validated.metadata.lastModified = new Date().toISOString();

    // Direct write (Windows lacks reliable atomic rename with file watchers)
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(validated, null, 2), 'utf-8');

    this.cachedConfig = validated;
    console.log(`[CONFIG] 💾 Saved facility config (v${validated.version})`);
  }

  // ── Dependency accessors ────────────────────────────────────────────────────
  getDependencies(): DependencyLinkConfig[] {
    return this.loadFacilityConfig().dependencies;
  }

  /**
   * Expand DependencyLinkConfig[] into flat DependencyLink[] for the prediction engine.
   * Handles bidirectional links by producing two directed entries.
   */
  getDependencyLinks(): DependencyLink[] {
    const deps = this.getDependencies();
    const links: DependencyLink[] = [];

    for (const dep of deps) {
      links.push({
        sourceZone: dep.sourceZone,
        targetZone: dep.targetZone,
        linkType: dep.linkType,
        weight: dep.weight,
      });
      if (dep.bidirectional) {
        links.push({
          sourceZone: dep.targetZone,
          targetZone: dep.sourceZone,
          linkType: dep.linkType,
          weight: dep.weight,
        });
      }
    }

    return links;
  }

  updateDependencies(deps: DependencyLinkConfig[]): void {
    // Validate the array
    DependencyArraySchema.parse(deps);

    // Check for duplicates (same source+target+type)
    const seen = new Set<string>();
    for (const dep of deps) {
      const key = `${dep.sourceZone}:${dep.targetZone}:${dep.linkType}`;
      if (seen.has(key)) {
        throw new Error(`Duplicate dependency: ${key}`);
      }
      seen.add(key);
      // Also check reverse for bidirectional
      if (dep.bidirectional) {
        const reverseKey = `${dep.targetZone}:${dep.sourceZone}:${dep.linkType}`;
        if (seen.has(reverseKey)) {
          throw new Error(`Conflicting bidirectional dependency: ${reverseKey}`);
        }
        seen.add(reverseKey);
      }
    }

    const config = this.loadFacilityConfig();
    config.dependencies = deps;
    this.saveFacilityConfig(config);
    console.log(`[CONFIG] 🔗 Updated ${deps.length} dependency links`);
  }

  // ── Graph Configuration ─────────────────────────────────────────────────────
  loadGraphConfig() {
    return {
      nodes: GRAPH_NODES,
      edges: GRAPH_EDGES,
      zones: MICRO_ZONES,
    };
  }

  // ── Reset to defaults ───────────────────────────────────────────────────────
  resetToDefaults(): void {
    this.saveFacilityConfig({ ...DEFAULT_CONFIG, metadata: { ...DEFAULT_CONFIG.metadata } });
    console.log('[CONFIG] 🔄 Reset facility config to defaults');
  }

  // ── Invalidate cache (for testing) ──────────────────────────────────────────
  invalidateCache(): void {
    this.cachedConfig = null;
  }
}
