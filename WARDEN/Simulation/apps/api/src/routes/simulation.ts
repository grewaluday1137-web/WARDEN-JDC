import { Router } from 'express';
import { StartSimSchema, InjectSchema, ResolveSchema, PlaybookCompleteSchema } from '../types';

export function setupSimulationRoutes(context: any) {
  const router = Router();
  const { 
    floorEngines, sessionService, io, FLOOR_COUNT, ALL_FLOORS, 
    buildFloorSnapshot, runMasterTick, setSimulationMode, getSimulationMode, 
    setMasterTickInterval, getMasterTickInterval, globalAutoSimulator, f1
  } = context;

  // Helper: resolve floor from request body
  function getFloor(body: any): number {
    const f = Number(body?.floor);
    if (f === 2 || f === 3) return f;
    return 1;
  }

  router.post('/simulation/start', (req, res) => {
    const parsed = StartSimSchema.safeParse(req.body);
    const mode = parsed.success && parsed.data ? parsed.data.mode : 'manual';
    setSimulationMode(mode);

    const floorZones = new Map<number, string[]>();
    for (const [floorId, fset] of floorEngines) {
      fset.orchestrator.reset();
      fset.orchestrator.start(mode);
      fset.env.setRestrictedZone(null);
      fset.predictionEngine.start();
      floorZones.set(floorId, fset.env.getZones());
    }

    if (mode === 'auto') {
      globalAutoSimulator.start(floorZones);
    }

    if (!getMasterTickInterval()) {
      setMasterTickInterval(setInterval(() => runMasterTick(), 250));
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`  🚀 MASTER SIMULATION STARTED [Mode: ${mode.toUpperCase()}]`);
      console.log('═══════════════════════════════════════════════════════════════');
    }

    sessionService.startSession(mode);
    res.json({ success: true, mode, floorCount: FLOOR_COUNT });
  });

  router.post('/simulation/stop', (_req, res) => {
    setSimulationMode('stopped');
    globalAutoSimulator.stop();
    const interval = getMasterTickInterval();
    if (interval) {
      clearInterval(interval);
      setMasterTickInterval(null);
      console.log('[SIM] Master tick loop stopped');
    }

    const endedSession = sessionService.endSession(f1.orchestrator.getTickCount()); // using f1 as base

    for (const [, fset] of floorEngines) {
      fset.orchestrator.stop();
      fset.evacuationEngine.stop();
      fset.evacuationEngine.reset();
      fset.faultManager.clearAll();
      fset.predictionEngine.reset();
      fset.env.reset();
      fset.env.setRestrictedZone(null);
      fset.stateMachine.reset();
      fset.ble.reset(25);
      fset.graphTickProcessor.reset();
      fset.orchestrator.reset();
      fset.cellularAutomata.reset();
    }
    context.taskBoardService.reset();

    const { floorPhysics, floorStates, floorGraphs, floorEpicenters } = buildFloorSnapshot();
    io.emit('snapshot', { 
      ...f1.orchestrator.getSnapshot(), 
      floorCount: FLOOR_COUNT, 
      floorPhysics, 
      floorStates,
      floorGraphs,
      floorEpicenters
    });

    res.json({ success: true, sessionId: endedSession?.id });
  });

  router.post('/inject', (req, res) => {
    const parsed = InjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const { zone, incidentType, floor, nodeId } = parsed.data;
    console.log(`[AUDIT] Injection Request: ${JSON.stringify(req.body)} from ${req.ip}`);

    const floorsToInject: number[] = [];
    if (Array.isArray(floor)) {
      floorsToInject.push(...floor);
    } else if (floor) {
      floorsToInject.push(floor);
    } else {
      floorsToInject.push(...ALL_FLOORS);
    }

    const typesToInject = Array.isArray(incidentType) ? incidentType : [incidentType];
    let fId = floorsToInject[Math.floor(Math.random() * floorsToInject.length)];
    
    if (typesToInject.includes('active_shooter')) {
      fId = 1;
    }
    
    const fset = floorEngines.get(fId);
    if (!fset) return res.status(500).json({ success: false, error: `Engine for floor ${fId} not initialized` });

    let targetZone: any = null;
    const activeNodes = new Set<string>();
    for (const nodes of Object.values(fset.graphTickProcessor.getEpicenters())) {
      if (Array.isArray(nodes)) nodes.forEach((id: any) => activeNodes.add(id));
    }

    const usedNodesInThisRequest = new Set<string>();
    for (const type of typesToInject) {
      let nodeToUse: string | null = null;
      let zoneToUse: any = null;

      if (type === 'active_shooter') {
        nodeToUse = 'F1_GROUND_N6';
        zoneToUse = 'D';
      } else if (nodeId && fset.graphTickProcessor.getGraphData().nodes.has(nodeId)) {
        nodeToUse = nodeId;
        const specificNode = fset.graphTickProcessor.getGraphData().nodes.get(nodeId);
        zoneToUse = specificNode ? specificNode.parentZone : zone;
      } else {
        const candidates = Array.from(fset.graphTickProcessor.getGraphData().nodes.values()).filter((n: any) => {
          if (activeNodes.has(n.id) || usedNodesInThisRequest.has(n.id)) return false;
          if (zone !== 'RANDOM' && n.parentZone !== zone) return false;
          return true;
        });

        if (candidates.length > 0) {
          const randomNode: any = candidates[Math.floor(Math.random() * candidates.length)];
          nodeToUse = randomNode.id;
          zoneToUse = randomNode.parentZone || 'A';
        } else {
          const allNodes = Array.from(fset.graphTickProcessor.getGraphData().nodes.values());
          const fallbackNodes = allNodes.filter((n: any) => !activeNodes.has(n.id) && !usedNodesInThisRequest.has(n.id));
          const finalCandidates = fallbackNodes.length > 0 ? fallbackNodes : allNodes;
          if (finalCandidates.length > 0) {
            const randomNode: any = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
            nodeToUse = randomNode.id;
            zoneToUse = randomNode.parentZone || 'A';
            console.warn(`[INJECT] Falling back to Node ${nodeToUse} in Zone ${zoneToUse}.`);
          }
        }
      }

      if (!nodeToUse) return res.status(400).json({ success: false, error: 'No nodes available' });
      targetZone = targetZone || zoneToUse;
      fset.graphTickProcessor.addEpicenter(zoneToUse, nodeToUse);
      fset.env.injectIncident(zoneToUse, type);
      fset.stateMachine.trigger(zoneToUse, type);

      const injectedNode = fset.graphTickProcessor.getGraphData().nodes.get(nodeToUse);
      if (injectedNode) fset.cellularAutomata.injectIncident(injectedNode.x, injectedNode.y, type);
      
      usedNodesInThisRequest.add(nodeToUse);
      console.log(`[INJECT] ✅ ACTIVATED Floor ${fId}, Node ${nodeToUse}, Zone ${zoneToUse}, Type ${type}`);
    }

    if (fset.orchestrator.getSimulationMode() === 'stopped') {
      setSimulationMode('manual');
      fset.orchestrator.start('manual');
    }

    if (!getMasterTickInterval()) {
      setMasterTickInterval(setInterval(() => runMasterTick(), 250));
      console.log('[SIM] Master tick loop started automatically via injection');
    }

    runMasterTick();
    res.json({ success: true, zone: targetZone, incidentTypes: typesToInject, floors: [fId] });
  });

  router.post('/resolve', (req, res) => {
    const parsed = ResolveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { zone } = parsed.data;
    const floor = getFloor(req.body);
    const fset = floorEngines.get(floor)!;

    fset.stateMachine.resolveIncident(zone);
    fset.ble.deactivateZone(zone);
    fset.predictionEngine.clearZone(zone);

    const { floorPhysics, floorStates } = buildFloorSnapshot();
    io.emit('tick', { ...fset.orchestrator.getSnapshot(), floorCount: FLOOR_COUNT, floorPhysics, floorStates });
    res.json({ success: true, zone, floor });
  });

  router.post('/playbook/complete', (req, res) => {
    const parsed = PlaybookCompleteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const { actionId } = parsed.data;
    const floor = getFloor(req.body);
    const fset = floorEngines.get(floor)!;

    const action = fset.stateMachine.getPlaybook().find((a: any) => a.id === actionId);
    fset.stateMachine.completePlaybookAction(actionId);
    if (action) fset.predictionEngine.mitigate(action.zone, action.incidentType);

    res.json({ success: true, actionId, floor });
  });

  return router;
}
