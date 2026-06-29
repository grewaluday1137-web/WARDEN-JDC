import { Router } from 'express';

export function setupSessionsRoutes(context: any) {
  const router = Router();
  const { sessionService } = context;

  router.get('/sessions', (_req, res) => res.json(sessionService.listSessions()));
  
  router.get('/sessions/:id', (req, res) => {
    const session = sessionService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  return router;
}
