import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Unauthorized } from '@tsed/exceptions';
import config from '@/config';
import { USER_ROLE } from '../generated/prisma';
import { BCRYPT_SALT_ROUNDS } from '@/utils/constants';
import { nanoid } from '@/modules/nanoid';

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

export const comparePassword = (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};

export const hashPassword = (password: string) => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
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
