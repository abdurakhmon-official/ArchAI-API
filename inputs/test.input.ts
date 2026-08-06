import { z } from 'zod';
import { TEST_OPTION } from '@/generated/prisma';

export const QuestionInputSchema = z.object({
  text: z.string().min(1),
  option_a: z.string().min(1),
  option_b: z.string().min(1),
  option_c: z.string().min(1),
  option_d: z.string().min(1),
  correct_option: z.nativeEnum(TEST_OPTION),
});

export const CreateTestInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  duration_minutes: z.coerce.number().int().positive().default(30),
  questions: z.array(QuestionInputSchema).min(1),
});

export const UpdateTestInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  duration_minutes: z.coerce.number().int().positive().optional(),
  active: z.boolean().optional(),
  questions: z.array(QuestionInputSchema).min(1).optional(),
});

export const SubmitTestAnswerInputSchema = z.object({
  question_id: z.string(),
  selected_option: z.nativeEnum(TEST_OPTION).optional().nullable(),
});

export const SubmitTestInputSchema = z.object({
  answers: z.array(SubmitTestAnswerInputSchema).min(1),
  duration_seconds: z.coerce.number().int().nonnegative().optional(),
});

export type QuestionInput = z.infer<typeof QuestionInputSchema>;
export type CreateTestInput = z.infer<typeof CreateTestInputSchema>;
export type UpdateTestInput = z.infer<typeof UpdateTestInputSchema>;
export type SubmitTestInput = z.infer<typeof SubmitTestInputSchema>;
