import { Router } from 'express';

export function setupReportsRoutes(context: any) {
  const router = Router();
  const { reportService, sessionService, floorEngines } = context;

  // Helper: resolve floor from request body
  function getFloor(body: any): number {
    const f = Number(body?.floor);
    if (f === 2 || f === 3) return f;
    return 1;
  }

  router.post('/reports/generate', (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      const session = sessionService.getSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const floor = getFloor(req.body);
      const fset = floorEngines.get(floor)!;
      const report = reportService.generate(
        session, 
        fset.stateMachine.getPlaybook(), 
        fset.faultManager.getState(), 
        fset.evacuationEngine.getMetrics(fset.orchestrator.getTickCount())
      );
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Report generation failed' });
    }
  });

  router.get('/reports', (_req, res) => res.json(reportService.listReports()));
  
  router.get('/reports/:id', (req, res) => {
    const report = reportService.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  });
  
  router.delete('/reports/:id', (req, res) => {
    const deleted = reportService.deleteReport(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true });
  });

  return router;
}
