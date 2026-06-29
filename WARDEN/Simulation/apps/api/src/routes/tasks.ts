import { Router } from 'express';

export function setupTasksRoutes(context: any) {
  const router = Router();
  const { taskBoardService, io } = context;

  router.get('/tasks', (_req, res) => {
    res.json(taskBoardService.getBoard());
  });

  router.get('/tasks/:id', (req, res) => {
    const task = taskBoardService.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.post('/tasks', (req, res) => {
    const { title, description, category, priority, targetZone, targetFloor, createdBy } = req.body;
    if (!title || !category || !priority || !createdBy) {
      return res.status(400).json({ error: 'title, category, priority, and createdBy are required' });
    }
    const task = taskBoardService.createTask({
      title,
      description: description || '',
      category,
      priority,
      targetZone,
      targetFloor,
      createdBy,
    });
    io.emit('ics:task_created', task);
    res.status(201).json(task);
  });

  router.patch('/tasks/:id/status', (req, res) => {
    const { status, actor } = req.body;
    if (!status || !actor) return res.status(400).json({ error: 'status and actor required' });
    const task = taskBoardService.updateStatus(req.params.id, status, actor);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    io.emit('ics:task_updated', task);
    res.json(task);
  });

  router.patch('/tasks/:id/assign', (req, res) => {
    const { unitName, actor } = req.body;
    if (!unitName || !actor) return res.status(400).json({ error: 'unitName and actor required' });
    const task = taskBoardService.assignUnit(req.params.id, unitName, actor);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    io.emit('ics:task_updated', task);
    res.json(task);
  });

  router.patch('/tasks/:id/priority', (req, res) => {
    const { priority, actor } = req.body;
    if (!priority || !actor) return res.status(400).json({ error: 'priority and actor required' });
    const task = taskBoardService.updatePriority(req.params.id, priority, actor);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    io.emit('ics:task_updated', task);
    res.json(task);
  });

  router.delete('/tasks/:id', (req, res) => {
    const deleted = taskBoardService.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    io.emit('ics:task_deleted', { id: req.params.id });
    res.json({ success: true });
  });

  router.get('/tasks/:id/audit', (req, res) => {
    const task = taskBoardService.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task.auditLog);
  });

  return router;
}
