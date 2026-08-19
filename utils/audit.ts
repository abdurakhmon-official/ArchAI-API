import prisma from '@/modules/db';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'recalculate'
  | 'deactivate';

interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  diff?: unknown;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor_id: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId ?? null,
        diff: (entry.diff ?? null) as never,
      },
    });
  } catch (error) {
    console.error('AUDIT_WRITE_FAILED', entry.entity, entry.action, error);
  }
}

export function diffOf(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, { from: unknown; to: unknown }> | null {
  if (!before || !after) return null;

  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key === 'updated_at' || key === 'created_at') continue;

    const from = before[key];
    const to = after[key];

    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from, to };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
