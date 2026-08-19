import { z } from 'zod';
import { PAYMENT_PROVIDER } from '../generated/prisma';

export const CheckoutInputSchema = z.object({
  planCode: z.string().min(2).max(30),
  provider: z.nativeEnum(PAYMENT_PROVIDER),
  months: z.number().int().min(1).max(12).default(1),
  returnUrl: z.string().url().optional(),
});

export const PaymeRequestSchema = z.object({
  method: z.enum([
    'CheckPerformTransaction',
    'CreateTransaction',
    'PerformTransaction',
    'CancelTransaction',
    'CheckTransaction',
    'GetStatement',
  ]),
  params: z.record(z.unknown()),
  id: z.union([z.number(), z.string()]).optional(),
});

export const ClickRequestSchema = z.object({
  click_trans_id: z.coerce.string(),
  service_id: z.coerce.string(),
  merchant_trans_id: z.coerce.string(),
  merchant_prepare_id: z.coerce.string().optional(),
  amount: z.coerce.number(),
  action: z.coerce.number().int(),
  error: z.coerce.number().int().optional(),
  error_note: z.string().optional(),
  sign_time: z.string(),
  sign_string: z.string(),
});

export type ClickRequest = z.infer<typeof ClickRequestSchema>;
export type PaymeRequest = z.infer<typeof PaymeRequestSchema>;
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const PlanLimitsSchema = z.object({
  projects: z.number().int().min(0).max(10_000),
  variants: z.number().int().min(1).max(20),
  versions: z.number().int().min(0).max(1000),
  pdf: z.boolean(),
  dwg: z.union([z.boolean(), z.literal('on_request')]),
  interior: z.boolean(),
  edit: z.boolean(),
  watermark: z.boolean(),
});

export const PlanInputSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name: z.object({ uz: z.string().min(1), ru: z.string().optional(), en: z.string().optional() }),
  description: z
    .object({ uz: z.string().min(1), ru: z.string().optional(), en: z.string().optional() })
    .optional()
    .nullable(),
  price_uzs: z.number().min(0).max(1_000_000_000),
  price_usd: z.number().min(0).max(100_000),
  limits: PlanLimitsSchema,
  sort: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

export type PlanInput = z.infer<typeof PlanInputSchema>;

export const PayoutCardInputSchema = z.object({
  provider: z.nativeEnum(PAYMENT_PROVIDER),
  label: z.string().min(2).max(60),
  last4: z.string().regex(/^\d{4}$/, 'must be exactly 4 digits'),
  holder: z.string().min(2).max(80),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'must be MM/YY'),
  account_id: z.string().min(1).max(120),
});

export type PayoutCardInput = z.infer<typeof PayoutCardInputSchema>;
