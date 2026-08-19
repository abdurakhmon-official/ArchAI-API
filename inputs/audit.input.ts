import { z } from 'zod';

export const AuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  entity: z.string().max(60).optional(),
  action: z.string().max(60).optional(),
  actorId: z.string().max(40).optional(),
});

export type AuditQuery = z.infer<typeof AuditQuerySchema>;
