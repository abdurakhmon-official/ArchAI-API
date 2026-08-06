import { z } from 'zod';

export const CreateSubjectInputSchema = z.object({
  name: z.string().min(1),
});

export type CreateSubjectInput = z.infer<typeof CreateSubjectInputSchema>;
