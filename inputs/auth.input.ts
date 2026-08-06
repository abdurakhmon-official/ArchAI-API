import { z } from 'zod';

export const SignupInputSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  subject: z.string().optional().nullable(),
  school_name: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatar: z.string().url().optional(),
});

export const SigninInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().nullable().optional(),
});

export const UpdatePasswordInputSchema = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(6),
});

export const UpdateProfileInputSchema = z.object({
  fullName: z.string().min(1),
  subject: z.string().optional().nullable(),
  school_name: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatar: z.string().url().optional(),
});

export type SignupInput = z.infer<typeof SignupInputSchema>;
export type SigninInput = z.infer<typeof SigninInputSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordInputSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
