import { z } from 'zod';
import { USER_ROLE } from '@/generated/prisma';

export const CreateUserInputSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(USER_ROLE).default(USER_ROLE.TEACHER),
  subject: z.string().optional().nullable(),
  school_name: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

export const UpdateUserRoleInputSchema = z.object({
  role: z.nativeEnum(USER_ROLE),
  subject: z.string().optional().nullable(),
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleInputSchema>;
