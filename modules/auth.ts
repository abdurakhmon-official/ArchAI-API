import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import argon2 from 'argon2';
import { Unauthorized } from '@tsed/exceptions';
import config from '@/config';
import { USER_ROLE } from '../generated/prisma';
import { nanoid } from '@/modules/nanoid';

const ARGON_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP recommendation
  timeCost: 2,
  parallelism: 1,
};

export type UserRole = {
  role: USER_ROLE | null;
};

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: USER_ROLE;
  jti: string;
  iat: number;
  exp: number;
}

export function Authenticate(role: USER_ROLE | null = null): UserRole {
  return { role };
}

/**
 * Verifies against either scheme. Old accounts still carry a bcrypt hash
 * and must keep working — `needsRehash` tells the caller when to replace
 * it, since only right here, with the plaintext in hand, can that happen.
 */
export const comparePassword = (password: string, hash: string) => {
  if (hash.startsWith('$argon2')) return argon2.verify(hash, password);
  return bcrypt.compare(password, hash);
};

export const needsRehash = (hash: string) => !hash.startsWith('$argon2');

export const hashPassword = (password: string) => {
  return argon2.hash(password, ARGON_OPTIONS);
};

export interface AccessToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export const createJWT = ({ id, email, role }: { id: string; email: string; role: USER_ROLE }) => {
  const token = jwt.sign({ email, role, jti: nanoid() }, config.jwt.secret, {
    subject: id,
    expiresIn: config.jwt.expiresIn,
  } as SignOptions);

  return token;
};

export const createAccessToken = (user: { id: string; email: string; role: USER_ROLE }): AccessToken => {
  const accessToken = createJWT(user);
  const { iat, exp } = jwt.decode(accessToken) as AccessTokenPayload;

  return { accessToken, tokenType: 'Bearer', expiresIn: exp - iat };
};

export const verifyJWT = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as AccessTokenPayload;
  } catch {
    throw new Unauthorized('Invalid or expired token');
  }
};
