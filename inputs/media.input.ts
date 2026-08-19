import { z } from 'zod';
import { MEDIA_TYPE } from '../generated/prisma';
import { MAX_UPLOAD_BYTES, UPLOAD_FOLDERS } from '@/utils/constants';

export const ConfirmUploadInputSchema = z.object({
  key: z
    .string()
    .min(3)
    .max(300)
    .refine(
      (value) => UPLOAD_FOLDERS.some((folder) => value.startsWith(`${folder}/`)),
      { message: 'VALIDATION_STORAGE_FOLDER' },
    )
    .refine((value) => !value.includes('..') && !value.includes('\\'), {
      message: 'VALIDATION_STORAGE_KEY',
    }),
  originalName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const RegisterMediaInputSchema = z.object({
  type: z.nativeEnum(MEDIA_TYPE),
  url: z.string().url().max(2000),
  key: z
    .string()
    .min(3)
    .max(300)
    .refine(
      (value) => UPLOAD_FOLDERS.some((folder) => value.startsWith(`${folder}/`)),
      { message: 'VALIDATION_STORAGE_FOLDER' },
    )
    .refine((value) => !value.includes('..') && !value.includes('\\'), {
      message: 'VALIDATION_STORAGE_KEY',
    }),
  originalName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInputSchema>;
export type RegisterMediaInput = z.infer<typeof RegisterMediaInputSchema>;
