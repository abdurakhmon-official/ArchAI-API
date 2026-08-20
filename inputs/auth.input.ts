import { z } from 'zod';

/**
 * Length only. Strength (weak/breached) is checked by
 * `PasswordSecurityService`, which zxcvbn-ts and HIBP do far better than
 * a hardcoded list ever could.
 */
export const PasswordSchema = z
  .string()
  .min(12, 'VALIDATION_PASSWORD_SHORT')
  .max(128, 'VALIDATION_PASSWORD_LONG');

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

export const PasswordStrengthInputSchema = z.object({
  password: z.string().max(128),
  email: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
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
export type PasswordStrengthInput = z.infer<typeof PasswordStrengthInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
