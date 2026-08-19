import {
  ForgotPasswordInput,
  ResetPasswordInput,
  SigninInput,
  SignupInput,
  UpdatePasswordInput,
  UpdateProfileInput,
} from '@/inputs/auth.input';
import { Authorized, Authenticate } from '@/middlewares/auth.middleware';
import { RATE_LIMITS, RateLimit } from '@/middlewares/rate-limit.middleware';
import { AuthService } from '@/services/auth.service';
import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams } from '@tsed/platform-params';
import { Post, Get, Put } from '@tsed/schema';

@Controller('/auth')
export class AuthController {
  @Inject()
  private authService!: AuthService;

  @Post('/signup')
  @RateLimit(RATE_LIMITS.auth)
  async signup(@BodyParams() data: SignupInput) {
    return await this.authService.signup(data);
  }

  @Post('/signin')
  @RateLimit(RATE_LIMITS.auth)
  async signin(@BodyParams() data: SigninInput) {
    return await this.authService.signin(data);
  }

  /**
   * Parolni tiklashni so'rash.
   *
   * Chegara IP bo'yicha: har so'rov begona manzilga xat yuborishi
   * mumkin, ya'ni bu uch pochta qutisini ko'mish quroliga aylanishi
   * mumkin edi.
   */
  @Post('/forgot-password')
  @RateLimit(RATE_LIMITS.passwordReset)
  async forgotPassword(@BodyParams() data: ForgotPasswordInput) {
    return this.authService.forgotPassword(data);
  }

  @Post('/reset-password')
  @RateLimit(RATE_LIMITS.auth)
  async resetPassword(@BodyParams() data: ResetPasswordInput) {
    return this.authService.resetPassword(data);
  }

  /** Tasdiqlash xatini qayta yuborish — faqat o'ziga. */
  @Post('/send-verification')
  @Authorized(Authenticate())
  @RateLimit(RATE_LIMITS.passwordReset)
  async sendVerification() {
    return this.authService.sendVerification();
  }

  /*
    Tasdiqlash: kirish TALAB QILINMAYDI.

    Odam xatni telefonda ochib, o'sha brauzerda tizimga kirmagan
    bo'lishi mumkin. Token o'zi kimligini isbotlaydi.
  */
  @Post('/verify-email/:token')
  @RateLimit(RATE_LIMITS.auth)
  async verifyEmail(@PathParams('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('/logout')
  @Authorized(Authenticate())
  async logout() {
    return await this.authService.logout();
  }

  @Get('/me')
  @Authorized(Authenticate())
  async me() {
    return await this.authService.me();
  }

  @Put('/me')
  @Authorized(Authenticate())
  async updateProfile(@BodyParams() data: UpdateProfileInput) {
    return await this.authService.updateProfile(data);
  }

  @Post('/update-password')
  @Authorized(Authenticate())
  @RateLimit(RATE_LIMITS.auth)
  async updatePassword(@BodyParams() data: UpdatePasswordInput) {
    return await this.authService.updatePassword(data);
  }
}
