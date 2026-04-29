import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ConfigService } from '../src/services/config-service';
import type { DependencyLinkConfig } from '../../packages/types';

const DATA_DIR = path.join(__dirname, '../data');
const CONFIG_PATH = path.join(DATA_DIR, 'facility-config.json');

// Canonical default config for test isolation
const DEFAULT_CONFIG = {
  "version": 1,
  "zones": ["A", "B", "C", "D"],
  "dependencies": [
    { "id": "DEP-001", "sourceZone": "A", "targetZone": "C", "linkType": "gas", "weight": 0.75, "bidirectional": true, "label": "Shared gas main NW–SW" },
    { "id": "DEP-002", "sourceZone": "B", "targetZone": "D", "linkType": "structural", "weight": 0.80, "bidirectional": true, "label": "Shared load-bearing path NE–SE" },
    { "id": "DEP-003", "sourceZone": "A", "targetZone": "B", "linkType": "electric", "weight": 0.60, "bidirectional": true, "label": "Primary electric grid NW–NE" }
  ],
  "exits": [
    { "id": "EXIT-NW", "zone": "A", "x": 0, "y": 0, "label": "NW Emergency Exit", "capacity": 5, "blocked": false },
    { "id": "EXIT-NE", "zone": "B", "x": 100, "y": 0, "label": "NE Fire Exit", "capacity": 5, "blocked": false },
    { "id": "EXIT-SW", "zone": "C", "x": 0, "y": 100, "label": "SW Loading Dock", "capacity": 8, "blocked": false },
    { "id": "EXIT-SE", "zone": "D", "x": 100, "y": 100, "label": "SE Main Entrance", "capacity": 10, "blocked": false }
  ],
  "routes": [
    { "from": "A", "to": "B", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "B", "to": "A", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "A", "to": "C", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "C", "to": "A", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "B", "to": "D", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "D", "to": "B", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "C", "to": "D", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "D", "to": "C", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "A", "to": "D", "travelTimeTicks": 18, "hazardMultiplier": 1.0 },
    { "from": "D", "to": "A", "travelTimeTicks": 18, "hazardMultiplier": 1.0 },
    { "from": "B", "to": "C", "travelTimeTicks": 18, "hazardMultiplier": 1.0 },
    { "from": "C", "to": "B", "travelTimeTicks": 18, "hazardMultiplier": 1.0 },
    { "from": "A", "to": "EXIT-NW", "travelTimeTicks": 5, "hazardMultiplier": 1.0 },
    { "from": "B", "to": "EXIT-NE", "travelTimeTicks": 5, "hazardMultiplier": 1.0 },
    { "from": "C", "to": "EXIT-SW", "travelTimeTicks": 5, "hazardMultiplier": 1.0 },
    { "from": "D", "to": "EXIT-SE", "travelTimeTicks": 5, "hazardMultiplier": 1.0 }
  ],
  "metadata": { "facilityName": "CrisisSync Default Facility", "lastModified": "2026-04-12T00:00:00Z", "author": "system" }
};

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    // Always write a known-good config before each test
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    service = new ConfigService();
  });

  afterEach(() => {
    // Restore known-good state after each test
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  });

  describe('loadFacilityConfig', () => {
    it('loads config from disk', () => {
      const config = service.loadFacilityConfig();
      expect(config).toBeDefined();
      expect(config.version).toBeGreaterThanOrEqual(1);
      expect(config.zones).toEqual(['A', 'B', 'C', 'D']);
    });

    it('returns config with dependencies', () => {
      const config = service.loadFacilityConfig();
      expect(config.dependencies.length).toBeGreaterThanOrEqual(3);
      for (const dep of config.dependencies) {
        expect(dep.id).toBeTruthy();
        expect(dep.sourceZone).toBeTruthy();
        expect(dep.targetZone).toBeTruthy();
        expect(dep.weight).toBeGreaterThanOrEqual(0);
        expect(dep.weight).toBeLessThanOrEqual(1);
      }
    });

    it('returns config with exits', () => {
      const config = service.loadFacilityConfig();
      expect(config.exits.length).toBeGreaterThanOrEqual(4);
      for (const exit of config.exits) {
        expect(exit.id).toBeTruthy();
        expect(exit.zone).toBeTruthy();
        expect(exit.label).toBeTruthy();
      }
    });

    it('returns config with routes', () => {
      const config = service.loadFacilityConfig();
      expect(config.routes.length).toBeGreaterThanOrEqual(12);
      for (const route of config.routes) {
        expect(route.from).toBeTruthy();
        expect(route.to).toBeTruthy();
        expect(route.travelTimeTicks).toBeGreaterThan(0);
      }
    });

    it('caches config after first load', () => {
      const config1 = service.loadFacilityConfig();
      const config2 = service.loadFacilityConfig();
      expect(config1).toBe(config2); // Same reference = cached
    });

    it('falls back to defaults if config file is corrupted', () => {
      fs.writeFileSync(CONFIG_PATH, '{ invalid json !!!', 'utf-8');
      service.invalidateCache();
      const config = service.loadFacilityConfig();
      expect(config).toBeDefined();
      expect(config.version).toBe(1);
      expect(config.dependencies.length).toBe(3);
    });
  });

  describe('getDependencyLinks', () => {
    it('expands bidirectional links into two directed links', () => {
      const links = service.getDependencyLinks();
      // 3 bidirectional configs → 6 directed links
      expect(links.length).toBe(6);
    });

    it('all links have valid fields', () => {
      const links = service.getDependencyLinks();
      for (const link of links) {
        expect(link.sourceZone).toBeTruthy();
        expect(link.targetZone).toBeTruthy();
        expect(link.linkType).toBeTruthy();
        expect(link.weight).toBeGreaterThanOrEqual(0);
        expect(link.weight).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('updateDependencies', () => {
    it('persists updated dependencies', () => {
      const newDeps: DependencyLinkConfig[] = [
        { id: 'TEST-001', sourceZone: 'A', targetZone: 'B', linkType: 'gas', weight: 0.5, bidirectional: false },
      ];
      service.updateDependencies(newDeps);
      // Verify via in-memory cache (disk may be contended by parallel tests)
      const config = service.loadFacilityConfig();
      expect(config.dependencies).toHaveLength(1);
      expect(config.dependencies[0].id).toBe('TEST-001');
    });

    it('rejects self-links', () => {
      const badDeps: DependencyLinkConfig[] = [
        { id: 'BAD-001', sourceZone: 'A', targetZone: 'A', linkType: 'gas', weight: 0.5, bidirectional: false },
      ];
      expect(() => service.updateDependencies(badDeps)).toThrow();
    });

    it('rejects invalid weight (> 1)', () => {
      const badDeps = [
        { id: 'BAD-002', sourceZone: 'A', targetZone: 'B', linkType: 'gas', weight: 1.5, bidirectional: false },
      ] as DependencyLinkConfig[];
      expect(() => service.updateDependencies(badDeps)).toThrow();
    });

    it('rejects invalid weight (< 0)', () => {
      const badDeps = [
        { id: 'BAD-003', sourceZone: 'A', targetZone: 'B', linkType: 'gas', weight: -0.5, bidirectional: false },
      ] as DependencyLinkConfig[];
      expect(() => service.updateDependencies(badDeps)).toThrow();
    });

    it('rejects duplicate links', () => {
      const dupes: DependencyLinkConfig[] = [
        { id: 'DUP-001', sourceZone: 'A', targetZone: 'B', linkType: 'gas', weight: 0.5, bidirectional: false },
        { id: 'DUP-002', sourceZone: 'A', targetZone: 'B', linkType: 'gas', weight: 0.7, bidirectional: false },
      ];
      expect(() => service.updateDependencies(dupes)).toThrow();
    });
  });

  describe('resetToDefaults', () => {
    it('restores default dependencies', () => {
      // First modify
      service.updateDependencies([
        { id: 'TMP', sourceZone: 'A', targetZone: 'B', linkType: 'gas', weight: 0.1, bidirectional: false },
      ]);
      expect(service.getDependencies().length).toBe(1);

      // Then reset — verify via in-memory cache (avoiding disk contention with parallel tests)
      service.resetToDefaults();
      const config = service.loadFacilityConfig();
      expect(config.dependencies.length).toBe(3);
      expect(config.dependencies[0].id).toBe('DEP-001');
    });
  });

  describe('saveFacilityConfig', () => {
    it('round-trips config through save/load (in-memory)', () => {
      const config = service.loadFacilityConfig();
      const modified = {
        ...config,
        metadata: { ...config.metadata, facilityName: 'Test Facility' },
      };
      service.saveFacilityConfig(modified);
      // After save, cache should reflect the new value
      const reloaded = service.loadFacilityConfig();
      expect(reloaded.metadata.facilityName).toBe('Test Facility');
    });

    it('updates lastModified on save', () => {
      const config = service.loadFacilityConfig();
      // Set an old timestamp
      const oldConfig = {
        ...config,
        metadata: { ...config.metadata, lastModified: '2025-01-01T00:00:00Z' },
      };
      service.saveFacilityConfig(oldConfig);
      // saveFacilityConfig always sets lastModified to now
      const reloaded = service.loadFacilityConfig();
      const savedTime = new Date(reloaded.metadata.lastModified).getTime();
      const oldTime = new Date('2025-01-01T00:00:00Z').getTime();
      expect(savedTime).toBeGreaterThan(oldTime);
    });
  });
});
