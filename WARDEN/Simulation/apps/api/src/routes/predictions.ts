import { Router } from 'express';

export function setupPredictionsRoutes(context: any) {
  const router = Router();
  const { f1 } = context; // Note: original code only pulled from f1 (floor 1)

  router.get('/predictions', (_req, res) => {
    res.json(f1.predictionEngine.getPredictions());
  });

  router.get('/predictions/explanations', (_req, res) => {
    res.json(f1.predictionEngine.getExplanations());
  });

  router.get('/predictions/:id/explanation', (req, res) => {
    const explanation = f1.predictionEngine.getExplanation(req.params.id);
    if (!explanation) return res.status(404).json({ error: 'Prediction not found or expired' });
    res.json(explanation);
  });

  return router;
}
