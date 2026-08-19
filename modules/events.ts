import { EventEmitter } from 'node:events';

export interface AppEvents {
  'project.saved': { projectId: string; userId: string; geometryHash: string };
  'project.deleted': { projectId: string; userId: string };
  'payment.completed': { paymentId: string; userId: string; subscriptionId: string | null };
  'payment.failed': { paymentId: string; userId: string; reason: string };
  'subscription.activated': { subscriptionId: string; userId: string; planCode: string };
  'subscription.expired': { subscriptionId: string; userId: string };
  'user.registered': { userId: string; email: string; locale: string };
  'user.password_reset_requested': { userId: string; email: string; token: string };
  'lead.created': { leadId: string; source: string };
}

export type AppEventName = keyof AppEvents;

class TypedEmitter {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  on<K extends AppEventName>(event: K, listener: (payload: AppEvents[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  once<K extends AppEventName>(event: K, listener: (payload: AppEvents[K]) => void): void {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
  }

  off<K extends AppEventName>(event: K, listener: (payload: AppEvents[K]) => void): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  emit<K extends AppEventName>(event: K, payload: AppEvents[K]): void {
    try {
      this.emitter.emit(event, payload);
    } catch (error) {
      console.error(`event listener failed: ${event}`, error);
    }
  }
}

export const events = new TypedEmitter();

export default events;
