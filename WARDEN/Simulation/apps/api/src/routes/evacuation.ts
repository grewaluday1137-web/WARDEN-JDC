import { Router } from 'express';

export function setupEvacuationRoutes(context: any) {
  const router = Router();
  const { floorEngines, sessionService } = context;

  // Helper: resolve floor from request body
  function getFloor(body: any): number {
    const f = Number(body?.floor);
    if (f === 2 || f === 3) return f;
    return 1;
  }

  router.post('/evacuation/start', (req, res) => {
    const floor = getFloor(req.body);
    const fset = floorEngines.get(floor)!;
    if (fset.evacuationEngine.isRunning()) return res.status(400).json({ error: 'Evacuation already in progress' });
    const people = fset.ble.getTrackedPeople();
    if (people.length === 0) return res.status(400).json({ error: 'No tracked people available' });
    fset.evacuationEngine.start(people, fset.orchestrator.getTickCount());
    sessionService.recordEvent('evacuation_started', `${people.length} agents`, fset.orchestrator.getTickCount());
    res.json({ success: true, agentCount: people.length, floor });
  });

  router.post('/evacuation/stop', (req, res) => {
    const floor = getFloor(req.body);
    const fset = floorEngines.get(floor)!;
    if (!fset.evacuationEngine.isRunning()) return res.status(400).json({ error: 'No evacuation in progress' });
    const metrics = fset.evacuationEngine.getMetrics(fset.orchestrator.getTickCount());
    fset.evacuationEngine.stop();
    sessionService.recordEvent('evacuation_completed', `${metrics?.evacuatedCount ?? 0} evacuated`, fset.orchestrator.getTickCount());
    res.json({ success: true, metrics, floor });
  });

  router.get('/evacuation', (req, res) => {
    const floor = getFloor(req.query);
    const fset = floorEngines.get(floor)!;
    res.json({
      active: fset.evacuationEngine.isRunning(),
      agents: fset.evacuationEngine.getAgents(),
      metrics: fset.evacuationEngine.getMetrics(fset.orchestrator.getTickCount()),
      floor,
    });
  });

  router.post('/evacuation/route', (req, res) => {
    const floor = getFloor(req.body);
    const fset = floorEngines.get(floor)!;
    const graphData = fset.graphTickProcessor.getGraphData();

    const { startNodeId, startX, startY, personId, avoidDangerous } = req.body;

    let resolvedStartNode: string | null = startNodeId || null;

    if (!resolvedStartNode && personId) {
      const positions = fset.ble.getAllPositions();
      const person = positions.find((p: any) => p.id === personId);
      if (person?.currentNode) {
        resolvedStartNode = person.currentNode;
      } else if (person) {
        const { findNearestNode } = require('../map/graph');
        const nearest = findNearestNode(graphData, person.x, person.y);
        resolvedStartNode = nearest.id;
      }
    }

    if (!resolvedStartNode && startX != null && startY != null) {
      const { findNearestNode } = require('../map/graph');
      const nearest = findNearestNode(graphData, startX, startY);
      resolvedStartNode = nearest.id;
    }

    if (!resolvedStartNode) {
      return res.status(400).json({ error: 'Must provide startNodeId, personId, or (startX, startY)' });
    }

    if (!graphData.nodes.has(resolvedStartNode)) {
      return res.status(404).json({ error: `Node ${resolvedStartNode} not found on floor ${floor}` });
    }

    const { findNearestExit } = require('../engine/pathfinding');

    const path = findNearestExit(
      resolvedStartNode,
      graphData.nodes,
      graphData.edges,
      graphData.zones,
      { avoidDangerous: avoidDangerous ?? true }
    );

    if (!path || path.length === 0) {
      const allExits = Array.from(graphData.nodes.values()).filter((n: any) => n.isExit);
      return res.json({
        path: [],
        exitNodeId: null,
        pathCoordinates: [],
        totalCost: Infinity,
        estimatedTimeSec: Infinity,
        riskScore: 100,
        blockedAlternatives: allExits.length,
        timestamp: Date.now(),
      });
    }

    const exitNodeId = path[path.length - 1];
    const pathCoordinates = path.map((nodeId: string) => {
      const node = graphData.nodes.get(nodeId)!;
      return { x: node.x, y: node.y, nodeId };
    });

    let totalCost = 0;
    let maxRisk = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const nodeEdges = graphData.edges.get(path[i]) ?? [];
      const edge = nodeEdges.find((e: any) => e.to === path[i + 1]);
      if (edge) totalCost += edge.weight;

      const node = graphData.nodes.get(path[i]);
      if (node) {
        const zone = graphData.zones.get(node.zoneId);
        if (zone && zone.riskLevel > maxRisk) maxRisk = zone.riskLevel;
      }
    }

    const allExits = Array.from(graphData.nodes.values()).filter((n: any) => n.isExit);
    let blockedAlternatives = 0;
    for (const exit of allExits) {
      if ((exit as any).id === exitNodeId) continue;
      const altPath = findNearestExit(resolvedStartNode, graphData.nodes, graphData.edges, graphData.zones, { avoidDangerous: true });
      if (!altPath) blockedAlternatives++;
    }

    res.json({
      path,
      exitNodeId,
      pathCoordinates,
      totalCost,
      estimatedTimeSec: Math.round(totalCost * 5),
      riskScore: maxRisk,
      blockedAlternatives,
      timestamp: Date.now(),
    });
  });

  return router;
}
