import { Router } from 'express';
import { FailureInjectionSchema } from '../types';

export function setupFaultsRoutes(context: any) {
  const router = Router();
  const { floorEngines, sessionService } = context;

  // Helper: resolve floor from request body
  function getFloor(body: any): number {
    const f = Number(body?.floor);
    if (f === 2 || f === 3) return f;
    return 1;
  }

  router.get('/faults', (req, res) => {
    const floor = getFloor(req.query);
    res.json(floorEngines.get(floor)!.faultManager.getState());
  });

  router.post('/faults/inject', (req, res) => {
    try {
      const floor = getFloor(req.body);
      const fset = floorEngines.get(floor)!;
      const input = FailureInjectionSchema.parse(req.body);
      const fault = fset.faultManager.inject(input, fset.orchestrator.getTickCount());
      sessionService.recordEvent('failure_injected', `${fault.subsystem}:${fault.mode}`, fset.orchestrator.getTickCount(), fault.targetZone, { faultId: fault.id, severity: fault.severity });
      res.json(fault);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid fault injection' });
    }
  });

  router.delete('/faults/:id', (req, res) => {
    const floor = getFloor(req.query);
    const fset = floorEngines.get(floor)!;
    const cleared = fset.faultManager.clear(req.params.id);
    if (!cleared) return res.status(404).json({ error: 'Fault not found' });
    sessionService.recordEvent('failure_cleared', req.params.id, fset.orchestrator.getTickCount());
    res.json({ success: true });
  });

  router.delete('/faults', (req, res) => {
    const floor = getFloor(req.query);
    const fset = floorEngines.get(floor)!;
    const count = fset.faultManager.clearAll();
    if (count > 0) sessionService.recordEvent('failure_cleared', `all (${count})`, fset.orchestrator.getTickCount());
    res.json({ success: true, cleared: count });
  });

  return router;
}
