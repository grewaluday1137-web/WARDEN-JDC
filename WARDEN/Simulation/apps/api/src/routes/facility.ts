import { Router } from 'express';
import { DependencyArraySchema } from '../types';

export function setupFacilityRoutes(context: any) {
  const router = Router();
  const { configService, floorEngines } = context;

  router.get('/facility/config', (_req, res) => {
    try { res.json(configService.loadFacilityConfig()); }
    catch (err: any) { res.status(500).json({ error: err.message || 'Unknown error' }); }
  });

  router.put('/facility/dependencies', (req, res) => {
    try {
      const parsed = DependencyArraySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      configService.updateDependencies(parsed.data);
      for (const [, fset] of floorEngines) (fset as any).predictionEngine.refreshDependencies();
      res.json({ success: true, count: parsed.data.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Unknown error' });
    }
  });

  router.post('/facility/validate', (req, res) => {
    const result = DependencyArraySchema.safeParse(req.body);
    res.json({ valid: result.success, errors: result.success ? [] : result.error.issues });
  });

  router.post('/facility/reset', (_req, res) => {
    configService.resetToDefaults();
    for (const [, fset] of floorEngines) (fset as any).predictionEngine.refreshDependencies();
    res.json({ success: true });
  });

  return router;
}
