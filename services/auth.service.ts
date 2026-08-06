import prisma from '@/modules/db';
import { comparePassword, createAccessToken, hashPassword } from '@/modules/auth';
import { BadRequest, NotFound, Unauthorized } from '@tsed/exceptions';
import { Inject, Injectable, InjectContext } from '@tsed/di';
import { PlatformContext } from '@tsed/common';
import { Request } from 'express';
import {
  SignupInput,
  SigninInput,
  SigninInputSchema,
  SignupInputSchema,
  UpdatePasswordInput,
  UpdatePasswordInputSchema,
  UpdateProfileInput,
  UpdateProfileInputSchema,
} from '@/inputs/auth.input';
import { TokenService } from '@/services/token.service';
import { USER_PUBLIC_SELECT } from '@/utils/constants';
import { USER_ROLE } from '@/generated/prisma';

@Injectable()
export class AuthService {
  @InjectContext()
  private context!: PlatformContext;

  @Inject()
  private tokenService!: TokenService;

  get req() {
    return this.context.getRequest<Request>();
  }

  get user() {
    return this.req.user;
  }

  async signup(input: SignupInput) {
    const data = SignupInputSchema.parse(input);
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new BadRequest('email already exist');
    }

    const hasUsers = await prisma.user.count();

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email,
        password: await hashPassword(data.password),
        subject: data.subject,
        school_name: data.school_name,
        region: data.region,
        district: data.district,
        phone: data.phone,
        avatar: data.avatar,
        role: hasUsers === 0 ? USER_ROLE.ADMIN : USER_ROLE.USER,
      },
      select: USER_PUBLIC_SELECT,
    });

    return {
      success: true,
      _message: 'registered successfully',
      data: createAccessToken(user),
    };
  }

  async signin(input: SigninInput) {
    const data = SigninInputSchema.parse(input);
    const email = data.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new BadRequest('invalid email or password');
    }

    const isValid = await comparePassword(data.password, user.password);

    if (!isValid) {
      throw new BadRequest('invalid email or password');
    }

    if (!user.active) {
      throw new Unauthorized('your account is inactive. please contact an administrator.');
    }

    return { success: true, data: createAccessToken(user) };
  }

  async logout() {
    const payload = this.req.auth;

    if (payload) {
      this.tokenService.revoke(payload);
    }

    return { success: true, _message: 'signed out' };
  }

  async me() {
    const user = await prisma.user.findUnique({
      where: { id: this.user?.id },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw new NotFound('user not found');
    }

    return {
      success: true,
      data: { ...user, isAdmin: user.role === USER_ROLE.ADMIN },
    };
  }

  async updateProfile(input: UpdateProfileInput) {
    const data = UpdateProfileInputSchema.parse(input);

    const updated = await prisma.user.update({
      where: { id: this.user?.id },
      data,
      select: USER_PUBLIC_SELECT,
    });

    return { success: true, _message: 'saved', data: updated };
  }

  async updatePassword(input: UpdatePasswordInput) {
    const data = UpdatePasswordInputSchema.parse(input);

    const user = await prisma.user.findUnique({ where: { id: this.user?.id } });

    if (!user) {
      throw new NotFound('user not found');
    }

    const isValid = await comparePassword(data.oldPassword, user.password);

    if (!isValid) {
      throw new BadRequest('current password is incorrect');
    }

    if (data.oldPassword === data.newPassword) {
      throw new BadRequest('new password must be different from the current password');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(data.newPassword) },
    });

    if (this.req.auth) {
      this.tokenService.revoke(this.req.auth);
    }

    return { success: true, _message: 'password updated. please sign in again.' };
  }
}
