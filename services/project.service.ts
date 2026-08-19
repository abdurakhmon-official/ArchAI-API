import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@tsed/di';
import { notFound, forbidden } from '@/utils/errors';
import { Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import events from '@/modules/events';
import {
  CreateProjectInputSchema,
  ListAllProjectsInputSchema,
  ListProjectsInputSchema,
  UpdateProjectInputSchema,
  UpdateSelectionInputSchema,
  type CreateProjectInput,
  type ListAllProjectsInput,
  type ListProjectsInput,
  type UpdateProjectInput,
  type UpdateSelectionInput,
} from '@/inputs/project.input';
import type { GeometryState } from '@/inputs/geometry.input';
import type { EstimateSelection } from '@/services/estimate.service';
import { GeometryService } from '@/services/geometry.service';
import { JobService } from '@/services/job.service';
import { PlanLimitException } from '@/middlewares/plan.middleware';
import { PlanService } from '@/services/plan.service';
import { recordAudit } from '@/utils/audit';
import { exportHashOf, hashOf } from '@/utils/hash';

/** Yumshoq o'chirilgan loyihalar shu muddat ichida tiklanadi. */
const RESTORE_WINDOW_DAYS = 30;

const LIST_SELECT = {
  id: true,
  title: true,
  note: true,
  cover_svg: true,
  estimate_total: true,
  finish_level: true,
  created_at: true,
  updated_at: true,
  style: { select: { slug: true, name: true } },
};

@Injectable()
export class ProjectService {
  @Inject()
  private geometryService!: GeometryService;

  @Inject()
  private jobService!: JobService;

  @Inject()
  private planService!: PlanService;

  async list(userId: string, input: ListProjectsInput) {
    const query = ListProjectsInputSchema.parse(input);

    const where: Prisma.ProjectWhereInput = {
      user_id: userId,
      deleted_at: null,
      ...(query.search
        ? { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
    };
  }

  /**
   * Barcha loyihalar — faqat admin uchun.
   *
   * `list` dan alohida turadi va bu ataylab: u yerda `user_id` filtri
   * QAT'IY, ya'ni tasodifan olib tashlash mumkin emas. Bitta funksiyaga
   * "admin bo'lsa filtrsiz" degan shart qo'shilsa, kelajakdagi bir
   * o'zgarish oddiy foydalanuvchiga hammaning loyihasini ochib
   * yuborishi mumkin edi.
   *
   * Tahrirlash yo'q: admin boshqa odamning rejasini o'zgartirmasligi
   * kerak. Ko'rish va o'chirish yetadi, va o'chirish jurnalga tushadi.
   */
  async listAll(input: ListAllProjectsInput) {
    const query = ListAllProjectsInputSchema.parse(input);

    const where: Prisma.ProjectWhereInput = {
      ...(query.deleted === 'exclude' ? { deleted_at: null } : {}),
      ...(query.deleted === 'only' ? { NOT: { deleted_at: null } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { user: { email: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
              { user: { fullName: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        select: {
          ...LIST_SELECT,
          deleted_at: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
    };
  }

  async byId(userId: string, id: string, isAdmin = false) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { style: { select: { slug: true, name: true } } },
    });

    if (!project || project.deleted_at) throw notFound('PROJECT_NOT_FOUND', 'project not found');
    if (project.user_id !== userId && !isAdmin) throw forbidden('PROJECT_NOT_OWNER', 'this project belongs to someone else');

    return { success: true, data: project };
  }

  async create(userId: string, input: CreateProjectInput) {
    const data = CreateProjectInputSchema.parse(input);

    const outcome = await this.geometryService.evaluate(
      data.geometry as GeometryState,
      data.finishLevel,
      data.selection ?? {},
    );

    const style = data.styleSlug
      ? await prisma.style.findUnique({ where: { slug: data.styleSlug }, select: { id: true } })
      : null;

    const project = await prisma.project.create({
      data: {
        user_id: userId,
        style_id: style?.id ?? null,
        skeleton_id: data.skeletonId ?? null,
        title: data.title,
        note: data.note ?? null,
        params: data.params as object,
        geometry: data.geometry as object,
        estimate: outcome.estimate as unknown as object,
        estimate_total: outcome.estimate.total,
        estimate_selection: selectionOrNull(data.selection),
        finish_level: data.finishLevel,
        cover_svg: outcome.coverSvg,
        versions: {
          create: {
            geometry: data.geometry as object,
            params: data.params as object,
            estimate_total: outcome.estimate.total,
            label: 'boshlang\'ich',
          },
        },
      },
      include: { style: { select: { slug: true, name: true } } },
    });

    events.emit('project.saved', {
      projectId: project.id,
      userId,
      geometryHash: hashOf(data.geometry),
    });

    return { success: true, _code: 'PROJECT_SAVED', _message: 'project saved', data: project };
  }

  async update(userId: string, id: string, input: UpdateProjectInput) {
    const data = UpdateProjectInputSchema.parse(input);
    const existing = await this.owned(userId, id);

    const geometry = (data.geometry ?? existing.geometry) as GeometryState;
    const finishLevel = data.finishLevel ?? existing.finish_level;
    const selection = data.selection ?? ((existing.estimate_selection ?? {}) as EstimateSelection);

    /**
     * Smeta qachon qayta hisoblanadi.
     *
     * Materiallar tanlovi ham shu ro'yxatda: u summani o'zgartiradi,
     * lekin geometriyani emas — shuning uchun quyida yangi versiya
     * yozilmaydi (versiya faqat `data.geometry` bilan yaratiladi).
     */
    const needsRecompute =
      data.geometry !== undefined ||
      data.selection !== undefined ||
      finishLevel !== existing.finish_level;

    const outcome = needsRecompute
      ? await this.geometryService.evaluate(geometry, finishLevel, selection)
      : null;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.selection !== undefined
          ? { estimate_selection: selectionOrNull(data.selection) }
          : {}),
        ...(outcome
          ? {
              geometry: geometry as unknown as object,
              estimate: outcome.estimate as unknown as object,
              estimate_total: outcome.estimate.total,
              cover_svg: outcome.coverSvg,
              finish_level: finishLevel,
            }
          : {}),
        ...(data.geometry
          ? {
              versions: {
                create: {
                  geometry: geometry as unknown as object,
                  params: existing.params as object,
                  estimate_total: outcome?.estimate.total ?? existing.estimate_total,
                  label: data.versionLabel ?? null,
                },
              },
            }
          : {}),
      },
      include: { style: { select: { slug: true, name: true } } },
    });

    return { success: true, _code: 'PROJECT_UPDATED', _message: 'project updated', data: project };
  }

  /**
   * Materiallar tanlovini saqlash.
   *
   * `update` dan alohida turishi ataylab: `PATCH /projects/:id` bepul
   * tarifda yopiq (`RequirePlan('EDIT')`), lekin smetani aniqlashtirish
   * hammaga ochiq bo'lishi kerak — aynan shu narsa mahsulotni foydali
   * qiladi va uni to'lov devori orqasiga qo'yish noto'g'ri bo'lardi.
   *
   * Geometriya bu yerda o'zgarmaydi, ya'ni versiya ham yozilmaydi.
   */
  async saveSelection(userId: string, id: string, input: UpdateSelectionInput) {
    const data = UpdateSelectionInputSchema.parse(input);
    const existing = await this.owned(userId, id);

    const outcome = await this.geometryService.evaluate(
      existing.geometry as GeometryState,
      existing.finish_level,
      data.selection,
    );

    const project = await prisma.project.update({
      where: { id },
      data: {
        estimate_selection: selectionOrNull(data.selection),
        estimate: outcome.estimate as unknown as object,
        estimate_total: outcome.estimate.total,
      },
      include: { style: { select: { slug: true, name: true } } },
    });

    return { success: true, _code: 'PROJECT_SELECTION_SAVED', _message: 'selection saved', data: project };
  }

  async versions(userId: string, id: string) {
    await this.owned(userId, id);

    const items = await prisma.projectVersion.findMany({
      where: { project_id: id },
      orderBy: { created_at: 'desc' },
      select: { id: true, label: true, estimate_total: true, created_at: true },
    });

    return { success: true, data: items };
  }

  async restoreVersion(userId: string, id: string, versionId: string) {
    await this.owned(userId, id);

    const version = await prisma.projectVersion.findUnique({ where: { id: versionId } });
    if (!version || version.project_id !== id) throw notFound('PROJECT_VERSION_NOT_FOUND', 'version not found');

    return this.update(userId, id, {
      geometry: version.geometry as GeometryState,
      versionLabel: 'versiyadan tiklandi',
    } as UpdateProjectInput);
  }

  /**
   * Yumshoq o'chirish.
   *
   * Admin boshqa odamning loyihasini ham o'chira oladi (shikoyat,
   * noo'rin mazmun), lekin bu HAR DOIM jurnalga tushadi — egasining
   * o'z loyihasini o'chirishi esa oddiy amal va jurnalni to'ldirmaydi.
   */
  async delete(userId: string, id: string, isAdmin = false) {
    const project = await this.owned(userId, id, isAdmin);

    await prisma.project.update({ where: { id }, data: { deleted_at: new Date() } });
    events.emit('project.deleted', { projectId: id, userId: project.user_id });

    if (isAdmin && project.user_id !== userId) {
      await recordAudit({
        actorId: userId,
        action: 'delete',
        entity: 'project',
        entityId: id,
        diff: { owner: project.user_id, title: project.title },
      });
    }

    return {
      success: true,
      _code: 'PROJECT_DELETED', _message: `project moved to trash, restorable for ${RESTORE_WINDOW_DAYS} days`,
      meta: { days: RESTORE_WINDOW_DAYS },
    };
  }

  async restore(userId: string, id: string, isAdmin = false) {
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) throw notFound('PROJECT_NOT_FOUND', 'project not found');
    if (project.user_id !== userId && !isAdmin) {
      throw forbidden('PROJECT_NOT_OWNER', 'this project belongs to someone else');
    }
    if (!project.deleted_at) return { success: true, _code: 'PROJECT_NOT_DELETED', _message: 'project is not deleted' };

    const deadline = new Date(project.deleted_at);
    deadline.setDate(deadline.getDate() + RESTORE_WINDOW_DAYS);

    if (deadline < new Date()) {
      throw notFound('PROJECT_RESTORE_EXPIRED', 'the restore window for this project has passed');
    }

    const restored = await prisma.project.update({ where: { id }, data: { deleted_at: null } });
    return { success: true, _code: 'PROJECT_RESTORED', _message: 'project restored', data: restored };
  }

  async recalculate(userId: string, id: string) {
    const existing = await this.owned(userId, id);

    const outcome = await this.geometryService.evaluate(
      existing.geometry as GeometryState,
      existing.finish_level,
      (existing.estimate_selection ?? {}) as EstimateSelection,
    );

    const project = await prisma.project.update({
      where: { id },
      data: {
        estimate: outcome.estimate as unknown as object,
        estimate_total: outcome.estimate.total,
      },
    });

    return { success: true, _code: 'PROJECT_RECALCULATED', _message: 'estimate recalculated', data: project };
  }

  async requestPdf(userId: string, id: string, locale = 'uz') {
    const project = await this.owned(userId, id);
    const plan = await this.planService.effectiveFor(userId);

    const result = await this.jobService.requestPdf(
      id,
      exportHashOf(project),
      plan.limits.watermark,
      locale,
    );

    return {
      success: true,
      _code: result.ready ? 'PROJECT_PDF_READY' : 'PROJECT_PDF_QUEUED',
      _message: result.ready ? 'PDF ready' : 'PDF is being prepared',
      data: result,
    };
  }

  /**
   * 3D rasm so'rovi.
   *
   * Interyer ko'rinishi pullik: `PlanLimits.interior` narxlash jadvalida
   * allaqachon reklama qilinadi va `PlanFeature` da ham bor edi, lekin
   * hech qayerda tekshirilmasdi — chunki interyer ko'rinishining o'zi
   * yo'q edi. Tashqi va kesma ko'rinish hammaga ochiq.
   *
   * Tekshiruv `@RequirePlan` bilan emas, shu yerda: bitta uchning
   * chegarasi so'rov PARAMETRIGA bog'liq, dekorator esa uni ko'rmaydi.
   */
  async requestRender(
    userId: string,
    id: string,
    view: 'exterior' | 'cutaway' | 'interior' = 'exterior',
    isAdmin = false,
  ) {
    const project = await this.owned(userId, id);

    // Admin chegaralardan o'tadi — `PlanMiddleware` dagi bilan bir xil.
    if (view === 'interior' && !isAdmin) {
      const plan = await this.planService.effectiveFor(userId);

      if (!plan.limits.interior) {
        throw new PlanLimitException(
          'PLAN_NO_INTERIOR',
          `the interior view is not part of the ${plan.code} plan`,
          { feature: 'INTERIOR', plan: plan.code },
        );
      }
    }

    const result = await this.jobService.requestRender(id, hashOf(project.geometry), view);

    return {
      success: true,
      _code: result.ready ? 'PROJECT_RENDER_READY' : 'PROJECT_RENDER_QUEUED',
      _message: result.ready ? 'image ready' : 'image is being prepared',
      data: result,
    };
  }

  /**
   * Loyihani egalik tekshiruvi bilan olish.
   *
   * `isAdmin` SUKUT BO'YICHA `false` — ya'ni chaqiruv joyida ataylab
   * berilmasa, tekshiruv har doim qat'iy qoladi. Tahrirlash yo'llari
   * (`update`, `recalculate`, `restoreVersion`) uni umuman
   * uzatmaydi: admin boshqa odamning rejasini o'zgartira olmaydi.
   */
  /**
   * Ulashish havolasini yoqadi.
   *
   * Token bir marta yaratiladi va qayta so'ralganda O'SHA qiymat
   * qaytadi: aks holda har bosishda eski havola o'lardi va
   * foydalanuvchi buni kutmasdi.
   */
  async share(userId: string, id: string) {
    const project = await this.owned(userId, id);

    const token =
      project.share_token ?? randomBytes(12).toString('base64url');

    if (!project.share_token) {
      await prisma.project.update({ where: { id }, data: { share_token: token } });
    }

    return { success: true, _code: 'PROJECT_SHARED', _message: 'share link ready', data: { token } };
  }

  /** Havolani o'chiradi — yuborilgan havola darhol ishlamay qoladi. */
  async unshare(userId: string, id: string) {
    await this.owned(userId, id);
    await prisma.project.update({ where: { id }, data: { share_token: null } });

    return { success: true, _code: 'PROJECT_UNSHARED', _message: 'share link removed' };
  }

  /**
   * Ulashilgan loyiha — kirishsiz.
   *
   * Faqat ko'rsatish uchun kerak bo'lgan maydonlar qaytadi: egasi,
   * uning emaili va ichki identifikatorlar bermaydi.
   */
  async byShareToken(token: string) {
    const project = await prisma.project.findUnique({
      where: { share_token: token },
      select: {
        title: true,
        note: true,
        geometry: true,
        params: true,
        estimate: true,
        estimate_total: true,
        finish_level: true,
        cover_svg: true,
        created_at: true,
        style: { select: { slug: true, name: true } },
        deleted_at: true,
      },
    });

    if (!project || project.deleted_at) throw notFound('PROJECT_SHARE_NOT_FOUND', 'shared project not found');

    const { deleted_at: _ignored, ...data } = project;
    return { success: true, data };
  }

  private async owned(userId: string, id: string, isAdmin = false) {
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project || project.deleted_at) throw notFound('PROJECT_NOT_FOUND', 'project not found');
    if (project.user_id !== userId && !isAdmin) {
      throw forbidden('PROJECT_NOT_OWNER', 'this project belongs to someone else');
    }

    return project;
  }
}

/**
 * Bo'sh tanlovni `null` sifatida yozamiz.
 *
 * Prisma'da `Json?` ustuniga `null` berish taqiqlangan — `Prisma.DbNull`
 * kerak. Bo'sh obyektni saqlash ham mumkin edi, lekin u holda "tanlov
 * yo'q" va "hamma tanlov bekor qilindi" bir xil ko'rinardi va
 * `exportHashOf` ikkalasini ajrata olmasdi.
 */
function selectionOrNull(
  selection: EstimateSelection | undefined,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  // Prisma `InputJsonValue` indeks imzosi bo'lgan tipni qabul qilmaydi,
  // shuning uchun bu yerda aniq o'girish kerak.
  return selection && Object.keys(selection).length > 0
    ? (selection as Prisma.InputJsonValue)
    : Prisma.DbNull;
}
