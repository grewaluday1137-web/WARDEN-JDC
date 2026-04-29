// ═══════════════════════════════════════════════════════════════════════════════
// CrisisSync — ICS Task Board Service
// In-memory Incident Command System task management with audit logging
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ICSTask, ICSTaskStatus, ICSTaskPriority, ICSTaskCategory,
  ICSAuditEntry, ICSTaskBoard, Zone, FloorId
} from '../types';

let taskIdCounter = 0;

function generateTaskId(): string {
  taskIdCounter++;
  return `ICS-${Date.now().toString(36).toUpperCase()}-${String(taskIdCounter).padStart(3, '0')}`;
}

export class TaskBoardService {
  private tasks: Map<string, ICSTask> = new Map();

  // ─── Create ───────────────────────────────────────────────────────────────
  createTask(params: {
    title: string;
    description: string;
    category: ICSTaskCategory;
    priority: ICSTaskPriority;
    targetZone?: Zone;
    targetFloor?: FloorId;
    createdBy: string;
  }): ICSTask {
    const now = Date.now();
    const task: ICSTask = {
      id: generateTaskId(),
      title: params.title,
      description: params.description,
      category: params.category,
      priority: params.priority,
      status: 'pending',
      assignedUnit: null,
      targetZone: params.targetZone ?? null,
      targetFloor: params.targetFloor ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      createdBy: params.createdBy,
      auditLog: [{
        timestamp: now,
        action: 'TASK_CREATED',
        actor: params.createdBy,
        details: `Task "${params.title}" created with priority ${params.priority}`,
      }],
    };
    this.tasks.set(task.id, task);
    return task;
  }

  // ─── Read ─────────────────────────────────────────────────────────────────
  getTask(id: string): ICSTask | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): ICSTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => {
        const priorityOrder: Record<ICSTaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.createdAt - a.createdAt;
      });
  }

  getBoard(): ICSTaskBoard {
    const tasks = this.getAllTasks();
    return {
      tasks,
      activeCount: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
      completedCount: tasks.filter(t => t.status === 'completed').length,
      lastUpdated: tasks.length > 0 ? Math.max(...tasks.map(t => t.updatedAt)) : Date.now(),
    };
  }

  // ─── Update Status ────────────────────────────────────────────────────────
  updateStatus(id: string, newStatus: ICSTaskStatus, actor: string): ICSTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    const oldStatus = task.status;
    task.status = newStatus;
    task.updatedAt = Date.now();
    if (newStatus === 'completed') task.completedAt = Date.now();

    task.auditLog.push({
      timestamp: Date.now(),
      action: 'STATUS_CHANGED',
      actor,
      details: `Status changed from ${oldStatus} to ${newStatus}`,
    });

    return task;
  }

  // ─── Assign Unit ──────────────────────────────────────────────────────────
  assignUnit(id: string, unitName: string, actor: string): ICSTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    const oldUnit = task.assignedUnit;
    task.assignedUnit = unitName;
    task.status = 'assigned';
    task.updatedAt = Date.now();

    task.auditLog.push({
      timestamp: Date.now(),
      action: 'UNIT_ASSIGNED',
      actor,
      details: oldUnit
        ? `Reassigned from "${oldUnit}" to "${unitName}"`
        : `Assigned to "${unitName}"`,
    });

    return task;
  }

  // ─── Update Priority ──────────────────────────────────────────────────────
  updatePriority(id: string, newPriority: ICSTaskPriority, actor: string): ICSTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;

    const oldPriority = task.priority;
    task.priority = newPriority;
    task.updatedAt = Date.now();

    task.auditLog.push({
      timestamp: Date.now(),
      action: 'PRIORITY_CHANGED',
      actor,
      details: `Priority changed from ${oldPriority} to ${newPriority}`,
    });

    return task;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  reset(): void {
    this.tasks.clear();
    taskIdCounter = 0;
  }
}
