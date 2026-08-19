import { z } from 'zod';

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyui', '11111111', '00000000', 'iloveyou', 'admin123',
  'welcome1', 'abc12345', 'letmein1', 'football', 'baseball', 'sunshine',
  'princess', 'dragon123', 'monkey12', 'parol123', 'toshkent', 'uzbekistan',
]);

export const PasswordSchema = z
  .string()
  .min(8, 'VALIDATION_PASSWORD_SHORT')
  .max(128)
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
    message: 'VALIDATION_PASSWORD_COMMON',
  })
  .refine((value) => !/^(.)\1+$/.test(value), {
    message: 'VALIDATION_PASSWORD_REPEATED',
  });

function assertNotDerived(password: string, ...parts: (string | null | undefined)[]): boolean {
  const value = password.toLowerCase();

  return !parts.some((part) => {
    const candidate = (part ?? '').toLowerCase().split('@')[0];
    return candidate.length >= 4 && value.includes(candidate);
  });
}

export const SignupInputSchema = z
  .object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: PasswordSchema,
    phone: z.string().optional().nullable(),
    locale: z.enum(['uz', 'ru', 'en']).default('uz'),
  })
  .refine((input) => assertNotDerived(input.password, input.email, input.fullName), {
    message: 'VALIDATION_PASSWORD_PERSONAL',
    path: ['password'],
  });

export const SigninInputSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().nullable().optional(),
});

export const UpdatePasswordInputSchema = z.object({
  oldPassword: z.string(),
  newPassword: PasswordSchema,
});

export const UpdateProfileInputSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  locale: z.enum(['uz', 'ru', 'en']).optional(),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(10),
  newPassword: PasswordSchema,
});

export type SignupInput = z.infer<typeof SignupInputSchema>;
export type SigninInput = z.infer<typeof SigninInputSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordInputSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
