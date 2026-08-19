import { z } from 'zod';
import { USER_ROLE } from '../generated/prisma';

export const CreateUserInputSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(USER_ROLE).default(USER_ROLE.USER),
  phone: z.string().optional().nullable(),
  locale: z.enum(['uz', 'ru', 'en']).default('uz'),
});

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const UpdateUserRoleInputSchema = z.object({
  role: z.nativeEnum(USER_ROLE),
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleInputSchema>;
