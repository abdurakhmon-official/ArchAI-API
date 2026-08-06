import { USER_ROLE } from '@/generated/prisma';

export const DEFAULT_PAGE_SIZE = 10;

export const BCRYPT_SALT_ROUNDS = 10;

export const USER_PUBLIC_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  subject: true,
  school_name: true,
  region: true,
  district: true,
  phone: true,
  avatar: true,
  active: true,
  created_at: true,
  updated_at: true,
};

export type RoleRequirements = {
  role: USER_ROLE | null;
};
