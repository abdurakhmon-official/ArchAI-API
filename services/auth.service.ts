import prisma from '@/modules/db';
import {
  clearLoginFailures,
  loginBlockedFor,
  LOGIN_GUARD,
  recordLoginFailure,
} from '@/utils/login-guard';
import { TooManyRequests } from '@/middlewares/rate-limit.middleware';
import { comparePassword, createAccessToken, hashPassword } from '@/modules/auth';
import { badRequest, notFound, unauthorized } from '@/utils/errors';
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
  ForgotPasswordInput,
  ForgotPasswordInputSchema,
  ResetPasswordInput,
  ResetPasswordInputSchema,
} from '@/inputs/auth.input';
import { TokenService } from '@/services/token.service';
import { USER_PUBLIC_SELECT } from '@/utils/constants';
import { USER_ROLE, VERIFICATION_PURPOSE } from '../generated/prisma';
import { emailQueue } from '@/modules/queue';
import { isRedisReady } from '@/modules/redis';
import { consumeToken, issueToken } from '@/utils/verification';

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
      throw badRequest('AUTH_EMAIL_TAKEN', 'email already registered');
    }

    const hasUsers = await prisma.user.count();

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email,
        password: await hashPassword(data.password),
        phone: data.phone,
        locale: data.locale,
        role: hasUsers === 0 ? USER_ROLE.ADMIN : USER_ROLE.USER,
      },
      select: USER_PUBLIC_SELECT,
    });

    return {
      success: true,
      _code: 'AUTH_SIGNED_UP', _message: 'registered successfully',
      data: createAccessToken(user),
    };
  }

  async signin(input: SigninInput) {
    const data = SigninInputSchema.parse(input);
    const email = data.email.toLowerCase();

    const blockedFor = await loginBlockedFor(email);
    if (blockedFor > 0) {
      throw new TooManyRequests(
        `too many failed attempts, try again in ${Math.ceil(blockedFor / 60)} minutes`,
        { retryAfter: blockedFor, limit: LOGIN_GUARD.MAX_FAILURES },
        'AUTH_TOO_MANY_ATTEMPTS',
        { minutes: Math.ceil(blockedFor / 60) },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await recordLoginFailure(email);
      throw badRequest('AUTH_INVALID_CREDENTIALS', 'invalid email or password');
    }

    const isValid = await comparePassword(data.password, user.password);

    if (!isValid) {
      await recordLoginFailure(email);
      throw badRequest('AUTH_INVALID_CREDENTIALS', 'invalid email or password');
    }

    if (!user.active) {
      throw unauthorized('AUTH_ACCOUNT_INACTIVE', 'this account is inactive');
    }

    await clearLoginFailures(email);

    return { success: true, data: createAccessToken(user) };
  }

  async logout() {
    const payload = this.req.auth;

    if (payload) {
      await this.tokenService.revoke(payload);
    }

    return { success: true, _code: 'AUTH_SIGNED_OUT', _message: 'signed out' };
  }

  async me() {
    const user = await prisma.user.findUnique({
      where: { id: this.user?.id },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw notFound('AUTH_USER_NOT_FOUND', 'user not found');
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

    return { success: true, _code: 'AUTH_PROFILE_SAVED', _message: 'saved', data: updated };
  }

  /**
   * Parolni tiklashni so'rash.
   *
   * Javob HAR DOIM bir xil: email ro'yxatdan o'tganmi yoki yo'qmi —
   * aytilmaydi. Aks holda bu uch hisob mavjudligini tekshirish
   * asbobiga aylanardi: kimdir minglab manzilni sinab, qaysilari
   * ro'yxatda borligini bilib olardi.
   */
  async forgotPassword(input: ForgotPasswordInput) {
    const data = ForgotPasswordInputSchema.parse(input);
    const email = data.email.toLowerCase();

    /*
      Navbat tayyorligi HAMMADAN oldin tekshiriladi.

      Ilgari bu tekshiruv foydalanuvchi topilgandan keyin turardi va
      shu bilan hisob mavjudligini oshkor qilardi: navbat ishlamaganda
      ma'lum manzil 400, noma'lum manzil esa 200 olardi. Ya'ni javob
      farqi bo'yicha qaysi email ro'yxatda borligini bilib olish
      mumkin edi — bu uchning butun ma'nosini buzardi.

      Yon foydasi: token ham bekorga yaratilmaydi.
    */
    this.assertMailReady();

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.active) {
      const token = await issueToken(user.id, VERIFICATION_PURPOSE.PASSWORD_RESET);
      await this.sendMail(user.email, 'reset', user.locale, { token, name: user.fullName });
    }

    return { success: true, _code: 'AUTH_RESET_REQUESTED', _message: 'if that address is registered, a reset link has been sent' };
  }

  /**
   * Yangi parol o'rnatish.
   *
   * Token bir marta ishlaydi va shu bilan birga BARCHA joriy
   * sessiyalar bekor qilinadi. Sabab: parolni tiklashning eng ko'p
   * uchraydigan holati — hisobga birov kirib qolgani. Eski token
   * ishlab tursa, tiklash ma'nosini yo'qotardi.
   */
  async resetPassword(input: ResetPasswordInput) {
    const data = ResetPasswordInputSchema.parse(input);

    const claimed = await consumeToken(data.token, VERIFICATION_PURPOSE.PASSWORD_RESET);
    if (!claimed) throw badRequest('AUTH_LINK_INVALID', 'this link is invalid or has expired');

    const user = await prisma.user.findUnique({ where: { id: claimed.userId } });
    if (!user) throw notFound('AUTH_USER_NOT_FOUND', 'user not found');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(data.newPassword),
        // Bu sana barcha eski tokenlarni bir yo'la o'ldiradi.
        password_changed_at: new Date(),
      },
    });

    /*
      Muvaffaqiyatsiz kirishlar hisobi ham tozalanadi.

      Parolni unutgan odam odatda uni bir necha marta noto'g'ri
      kiritgan bo'ladi va hisob bloklangan bo'lishi mumkin. Yangi
      parol o'rnatilgach ham "juda ko'p urinish" xabari chiqsa,
      tiklash amalda ishlamagan bo'lardi.
    */
    await clearLoginFailures(user.email);

    return { success: true, _code: 'AUTH_PASSWORD_RESET', _message: 'password changed, every other session was signed out' };
  }

  /** Email tasdiqlash havolasini yuborish. */
  async sendVerification() {
    const user = await prisma.user.findUnique({ where: { id: this.user?.id } });
    if (!user) throw notFound('AUTH_USER_NOT_FOUND', 'user not found');

    if (user.email_verified) {
      return { success: true, _code: 'AUTH_ALREADY_VERIFIED', _message: 'this address is already verified' };
    }

    this.assertMailReady();

    const token = await issueToken(user.id, VERIFICATION_PURPOSE.EMAIL);
    await this.sendMail(user.email, 'verify', user.locale, { token, name: user.fullName });

    return { success: true, _code: 'AUTH_VERIFICATION_SENT', _message: 'Tasdiqlash xati yuborildi' };
  }

  /**
   * Email manzilini tasdiqlash.
   *
   * Kirish TALAB QILINMAYDI: odam xatni telefonda ochib, brauzerda
   * tizimga kirmagan bo'lishi mumkin. Token o'zi kimligini isbotlaydi.
   */
  async verifyEmail(token: string) {
    const claimed = await consumeToken(token, VERIFICATION_PURPOSE.EMAIL);
    if (!claimed) throw badRequest('AUTH_LINK_INVALID', 'this link is invalid or has expired');

    await prisma.user.update({
      where: { id: claimed.userId },
      data: { email_verified: true },
    });

    return { success: true, _code: 'AUTH_EMAIL_VERIFIED', _message: 'address verified' };
  }

  /**
   * Xatni navbatga qo'yish.
   *
   * Navbat ishlamayotgan bo'lsa XATO qaytadi. "Yubordik" deb aytib,
   * aslida yubormaslik eng yomon variant: foydalanuvchi pochtasini
   * kutib o'tiraveradi va muammo qayerda ekanini bilmaydi.
   */
  /**
   * Navbat tayyormi.
   *
   * Tayyor bo'lmasa XATO qaytadi. "Yubordik" deb aytib, aslida
   * yubormaslik eng yomon variant: foydalanuvchi pochtasini kutib
   * o'tiraveradi va muammo qayerda ekanini bilmaydi.
   */
  private assertMailReady() {
    if (!isRedisReady()) throw badRequest('AUTH_MAIL_UNAVAILABLE', 'mail cannot be sent right now, try again shortly');
  }

  private async sendMail(
    to: string,
    template: 'reset' | 'verify',
    locale: string,
    payload: Record<string, unknown>,
  ) {
    await emailQueue.add(template, { to, template, locale, payload });
  }

  async updatePassword(input: UpdatePasswordInput) {
    const data = UpdatePasswordInputSchema.parse(input);

    const user = await prisma.user.findUnique({ where: { id: this.user?.id } });

    if (!user) {
      throw notFound('AUTH_USER_NOT_FOUND', 'user not found');
    }

    const isValid = await comparePassword(data.oldPassword, user.password);

    if (!isValid) {
      throw badRequest('AUTH_PASSWORD_INCORRECT', 'current password is incorrect');
    }

    if (data.oldPassword === data.newPassword) {
      throw badRequest('AUTH_PASSWORD_SAME', 'the new password must differ from the current one');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(data.newPassword),
        password_changed_at: new Date(),
      },
    });

    if (this.req.auth) {
      await this.tokenService.revoke(this.req.auth);
    }

    return { success: true, _code: 'AUTH_PASSWORD_UPDATED', _message: 'password updated. please sign in again.' };
  }
}
