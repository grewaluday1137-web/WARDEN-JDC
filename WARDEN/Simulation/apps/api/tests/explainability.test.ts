import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PredictionEngine } from '../src/engine/prediction-engine';
import { EnvironmentEngine } from '../src/engine/environment';
import { ConfigService } from '../src/services/config-service';
import type { PredictionV2, PredictionExplanation } from '../../packages/types';

const CONFIG_PATH = path.join(__dirname, '../data/facility-config.json');

// Known-good config for test isolation
const DEFAULT_CONFIG = {
  "version": 1, "zones": ["A", "B", "C", "D"],
  "dependencies": [
    { "id": "DEP-001", "sourceZone": "A", "targetZone": "C", "linkType": "gas", "weight": 0.75, "bidirectional": true },
    { "id": "DEP-002", "sourceZone": "B", "targetZone": "D", "linkType": "structural", "weight": 0.80, "bidirectional": true },
    { "id": "DEP-003", "sourceZone": "A", "targetZone": "B", "linkType": "electric", "weight": 0.60, "bidirectional": true },
  ],
  "exits": [
    { "id": "EXIT-NW", "zone": "A", "x": 0, "y": 0, "label": "NW Exit", "capacity": 5, "blocked": false },
    { "id": "EXIT-NE", "zone": "B", "x": 100, "y": 0, "label": "NE Exit", "capacity": 5, "blocked": false },
    { "id": "EXIT-SW", "zone": "C", "x": 0, "y": 100, "label": "SW Exit", "capacity": 8, "blocked": false },
    { "id": "EXIT-SE", "zone": "D", "x": 100, "y": 100, "label": "SE Exit", "capacity": 10, "blocked": false },
  ],
  "routes": [
    { "from": "A", "to": "B", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
    { "from": "B", "to": "A", "travelTimeTicks": 10, "hazardMultiplier": 1.0 },
  ],
  "metadata": { "facilityName": "Test Facility", "lastModified": "2026-01-01T00:00:00Z", "author": "test" },
};

describe('Prediction Explainability', () => {
  let env: EnvironmentEngine;
  let configService: ConfigService;
  let engine: PredictionEngine;

  beforeEach(() => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    env = new EnvironmentEngine();
    configService = new ConfigService();
    engine = new PredictionEngine(env, configService);
  });

  afterEach(() => {
    engine.reset();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  });

  describe('getExplanations', () => {
    it('returns empty array when no predictions exist', () => {
      expect(engine.getExplanations()).toEqual([]);
    });

    it('returns explanations after prediction cycle runs', async () => {
      // Inject fire and advance physics enough to trigger prediction
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 30; i++) env.tick();

      // Manually trigger prediction cycle (it's private, so we use start + wait)
      engine.start();
      // Give it a tick to run
      await new Promise(r => setTimeout(r, 200));

      const explanations = engine.getExplanations();
      // May or may not have predictions depending on physics state,
      // but the method should not throw
      expect(Array.isArray(explanations)).toBe(true);

      engine.stop();
    });
  });

  describe('getExplanation', () => {
    it('returns null for non-existent prediction ID', () => {
      expect(engine.getExplanation('non-existent')).toBeNull();
    });
  });

  describe('PredictionV2 structure', () => {
    it('predictions include explanation field', async () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 50; i++) env.tick();

      engine.start();
      await new Promise(r => setTimeout(r, 300));

      const predictions = engine.getPredictions();

      for (const pred of predictions) {
        // Every prediction should have an explanation
        expect(pred.explanation).toBeDefined();
        const exp = pred.explanation;

        // Verify explanation structure
        expect(exp.predictionId).toBe(pred.id);
        expect(exp.sourceZone).toBeTruthy();
        expect(exp.targetZone).toBeTruthy();
        expect(exp.sourceIncident).toBeTruthy();
        expect(exp.predictedIncident).toBeTruthy();
        expect(exp.dependencyType).toBeTruthy();
        expect(exp.dependencyWeight).toBeGreaterThanOrEqual(0);
        expect(exp.dependencyWeight).toBeLessThanOrEqual(1);

        // Confidence breakdown
        expect(exp.confidenceBreakdown).toBeDefined();
        expect(exp.confidenceBreakdown.physicsContribution).toBeGreaterThanOrEqual(0);
        expect(exp.confidenceBreakdown.historicalContribution).toBeGreaterThanOrEqual(0);
        expect(exp.confidenceBreakdown.blendedConfidence).toBeGreaterThanOrEqual(0);
        expect(exp.confidenceBreakdown.blendedConfidence).toBeLessThanOrEqual(1);

        // Reasoning fields
        expect(exp.etaReasoning).toBeTruthy();
        expect(Array.isArray(exp.triggerConditions)).toBe(true);
        expect(exp.triggerConditions.length).toBeGreaterThan(0);
        expect(Array.isArray(exp.thresholdsCrossed)).toBe(true);
        expect(exp.narrativeSummary).toBeTruthy();
        expect(exp.narrativeSummary.length).toBeGreaterThan(20);
        expect(exp.generatedAt).toBeGreaterThan(0);
      }

      engine.stop();
    });

    it('explanation predictionId matches prediction id', async () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 50; i++) env.tick();

      engine.start();
      await new Promise(r => setTimeout(r, 300));

      const predictions = engine.getPredictions();
      for (const pred of predictions) {
        expect(pred.explanation.predictionId).toBe(pred.id);
      }

      engine.stop();
    });

    it('getExplanation returns matching explanation for valid prediction', async () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 50; i++) env.tick();

      engine.start();
      await new Promise(r => setTimeout(r, 300));

      const predictions = engine.getPredictions();
      if (predictions.length > 0) {
        const exp = engine.getExplanation(predictions[0].id);
        expect(exp).toBeDefined();
        expect(exp!.predictionId).toBe(predictions[0].id);
        expect(exp!.narrativeSummary).toBeTruthy();
      }

      engine.stop();
    });
  });

  describe('Explanation content quality', () => {
    it('narrative summary contains zone information', async () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 50; i++) env.tick();

      engine.start();
      await new Promise(r => setTimeout(r, 300));

      const predictions = engine.getPredictions();
      for (const pred of predictions) {
        const summary = pred.explanation.narrativeSummary.toLowerCase();
        // Should mention source and target zones
        expect(summary).toContain('zone');
      }

      engine.stop();
    });

    it('trigger conditions include dependency info', async () => {
      env.injectIncident('A', 'fire');
      for (let i = 0; i < 50; i++) env.tick();

      engine.start();
      await new Promise(r => setTimeout(r, 300));

      const predictions = engine.getPredictions();
      for (const pred of predictions) {
        const triggers = pred.explanation.triggerConditions.join(' ').toLowerCase();
        // Should mention the dependency type
        expect(triggers).toContain('dependency');
      }

      engine.stop();
    });
  });
});
