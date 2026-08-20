import { USER_ROLE } from '../generated/prisma';

export const DEFAULT_PAGE_SIZE = 10;

export const BCRYPT_SALT_ROUNDS = 10;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const UPLOAD_FOLDERS = [
  'furniture',
  'style-preview',
  'skeleton-preview',
  'blog',
  'avatar',
] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const READABLE_ASSET_FOLDERS = [...UPLOAD_FOLDERS, 'pdf', 'render'] as const;

export type ReadableAssetFolder = (typeof READABLE_ASSET_FOLDERS)[number];

export const UPLOAD_MIME_TYPES: Record<string, 'IMAGE' | 'MODEL' | 'DOCUMENT'> = {
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/gif': 'IMAGE',
  'image/avif': 'IMAGE',
  'model/gltf-binary': 'MODEL',
  'model/gltf+json': 'MODEL',
  'application/pdf': 'DOCUMENT',
};

export const USER_PUBLIC_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  phone: true,
  avatar: true,
  locale: true,
  emailVerified: true,
  passwordChangedAt: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

export type RoleRequirements = {
  role: USER_ROLE | null;
};
