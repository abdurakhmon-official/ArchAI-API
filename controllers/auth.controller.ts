import { SigninInput, SignupInput, UpdatePasswordInput, UpdateProfileInput } from '@/inputs/auth.input';
import { Authorized, Authenticate } from '@/middlewares/auth.middleware';
import { AuthService } from '@/services/auth.service';
import { Controller, Inject } from '@tsed/di';
import { BodyParams } from '@tsed/platform-params';
import { Post, Get, Put } from '@tsed/schema';

@Controller('/auth')
export class AuthController {
  @Inject()
  private authService!: AuthService;

  @Post('/signup')
  async signup(@BodyParams() data: SignupInput) {
    return await this.authService.signup(data);
  }

  @Post('/signin')
  async signin(@BodyParams() data: SigninInput) {
    return await this.authService.signin(data);
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
  async updatePassword(@BodyParams() data: UpdatePasswordInput) {
    return await this.authService.updatePassword(data);
  }
}
