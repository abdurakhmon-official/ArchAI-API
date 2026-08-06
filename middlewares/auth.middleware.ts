import { Req } from '@tsed/common';
import { Context } from '@tsed/platform-params';
import { Middleware, MiddlewareMethods, UseAuth } from '@tsed/platform-middlewares';
import { Forbidden, Unauthorized } from '@tsed/exceptions';
import { Inject } from '@tsed/di';
import { useDecorators } from '@tsed/core';
import { Returns, Security } from '@tsed/schema';
import { Request } from 'express';
import { USER_ROLE } from '@/generated/prisma';
import prisma from '@/modules/db';
import { Authenticate, verifyJWT } from '@/modules/auth';
import { TokenService } from '@/services/token.service';
import { USER_PUBLIC_SELECT, RoleRequirements } from '@/utils/constants';

@Middleware()
export class AuthMiddleware implements MiddlewareMethods {
  @Inject()
  private tokenService!: TokenService;

  public async use(@Req() request: Req, @Context() ctx: Context) {
    const options: RoleRequirements = ctx.endpoint.get(AuthMiddleware) || { role: null };

    await this.resolveUser(request as unknown as Request);

    const user = request.user;

    if (!user) {
      throw new Unauthorized('Unauthorized');
    }

    if (user.role === USER_ROLE.ADMIN) {
      return true;
    }

    if (options.role && user.role !== options.role) {
      throw new Forbidden('You are not authorized to access this resource.');
    }

    return true;
  }

  private async resolveUser(request: Request) {
    const clientToken = request.token;

    if (!clientToken) {
      throw new Unauthorized('Unauthorized');
    }

    const payload = verifyJWT(clientToken);

    if (this.tokenService.isRevoked(payload.jti)) {
      throw new Unauthorized('Session has been terminated. Please sign in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw new Unauthorized('Unauthorized');
    }

    if (!user.active) {
      throw new Forbidden('Your account has been deactivated. Please contact an administrator.');
    }

    request.user = { ...user, isAdmin: user.role === USER_ROLE.ADMIN };
    request.auth = payload;
  }
}

export { Authenticate };
export type { RoleRequirements };

export function AdminOnly(): RoleRequirements {
  return Authenticate(USER_ROLE.ADMIN);
}

export function TeacherOnly(): RoleRequirements {
  return Authenticate(USER_ROLE.TEACHER);
}

export function Authorized(options: RoleRequirements = { role: null }): Function {
  return useDecorators(
    UseAuth(AuthMiddleware, options),
    Security('bearerAuth'),
    Returns(401).Description('missing, invalid or revoked access token'),
    Returns(403).Description('authenticated but not allowed to perform this action'),
  );
}
