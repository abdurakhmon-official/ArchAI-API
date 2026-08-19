import { Injectable } from '@tsed/di';
import { notFound } from '@/utils/errors';
import { LEAD_STATUS, Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import events from '@/modules/events';
import {
  LeadInputSchema,
  UpdateLeadInputSchema,
  type LeadInput,
  type UpdateLeadInput,
} from '@/inputs/content.input';

@Injectable()
export class LeadService {
  async create(input: LeadInput) {
    const data = LeadInputSchema.parse(input);

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: data.phone,
        message: data.message ?? null,
        source: data.source,
        payload: (data.payload ?? undefined) as Prisma.InputJsonValue,
      },
    });

    events.emit('lead.created', { leadId: lead.id, source: lead.source });

    return {
      success: true,
      _code: 'LEAD_CREATED', _message: 'request received, we will get in touch shortly',
      data: { id: lead.id },
    };
  }

  async list(query: { page?: number; limit?: number; status?: LEAD_STATUS } = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.LeadWhereInput = query.status ? { status: query.status } : {};

    const [items, total, open] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { status: LEAD_STATUS.NEW } }),
    ]);

    return {
      success: true,
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit), open },
    };
  }

  async update(id: string, input: UpdateLeadInput) {
    const data = UpdateLeadInputSchema.parse(input);

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw notFound('LEAD_NOT_FOUND', 'lead not found');

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.admin_note !== undefined ? { admin_note: data.admin_note } : {}),
      },
    });

    return { success: true, _code: 'LEAD_UPDATED', _message: 'lead updated', data: lead };
  }

  async remove(id: string) {
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw notFound('LEAD_NOT_FOUND', 'lead not found');

    await prisma.lead.delete({ where: { id } });
    return { success: true, _code: 'LEAD_REMOVED', _message: 'lead removed' };
  }
}
