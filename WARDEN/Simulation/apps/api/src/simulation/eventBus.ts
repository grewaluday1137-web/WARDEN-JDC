import { CrisisEventType, CrisisEvent } from '@crisis/types';

export class CrisisEventBus {
  private listeners = new Map<CrisisEventType, Set<(event: CrisisEvent) => void>>();
  private tickEvents: CrisisEvent[] = [];

  /**
   * Subscribe to a specific event type. Returns an unsubscribe function.
   */
  subscribe(type: CrisisEventType, handler: (event: CrisisEvent) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  /**
   * Publish an event. Notifies all subscribers and collects the event for tick flush.
   */
  publish(event: CrisisEvent): void {
    this.tickEvents.push(event);
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[EVENT-BUS] Handler error for ${event.type}:`, err);
        }
      }
    }
  }

  /**
   * Publish a raw event that is not necessarily a typed CrisisEvent.
   * Used by subsystems like EntrySecuritySystem that emit non-graph events.
   */
  publishRaw(event: Omit<CrisisEvent, 'tick'> & { tick?: number }): void {
    const fullEvent: CrisisEvent = { tick: -1, ...event } as CrisisEvent;
    this.tickEvents.push(fullEvent);
  }

  /**
   * Returns all events collected since last flush, then clears the buffer.
   * Called once per tick by the orchestrator.
   */
  flushTick(): CrisisEvent[] {
    const events = [...this.tickEvents];
    this.tickEvents = [];
    return events;
  }

  /**
   * Remove all subscribers (useful for cleanup/testing).
   */
  clear(): void {
    this.listeners.clear();
    this.tickEvents = [];
  }

  /**
   * Get count of pending events (useful for diagnostics).
   */
  get pendingCount(): number {
    return this.tickEvents.length;
  }
}
