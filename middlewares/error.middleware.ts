import { Catch, ExceptionFilterMethods } from '@tsed/platform-exceptions';
import { PlatformContext } from '@tsed/common';
import { Exception } from '@tsed/exceptions';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma';
import config from '@/config';

interface ErrorResponse {
  success: false;
  _message: string;
  /** Translation key. The browser renders this, not `_message`. */
  _code?: string;
  code?: string;
  meta?: Record<string, unknown>;
  errors?: { field: string; message: string }[];
  stack?: string;
}

@Catch(Error, Exception)
export class GlobalErrorFilter implements ExceptionFilterMethods {
  catch(exception: Error, ctx: PlatformContext) {
    const { status, body } = this.toResponse(exception);

    if (status >= 500) {
      ctx.logger.error({ event: 'UNHANDLED_ERROR', message: exception.message, stack: exception.stack });
    }

    ctx.response.status(status).body(body);
  }

  private toResponse(exception: Error): { status: number; body: ErrorResponse } {
    if (exception instanceof ZodError) {
      return {
        status: 400,
        body: {
          success: false,
          _message: 'Validation failed',
          errors: exception.errors.map(issue => ({
            field: issue.path.join('.') || '(body)',
            message: issue.message,
          })),
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: 400, body: { success: false, _message: 'Invalid data sent to the database layer' } };
    }

    if (exception instanceof Exception) {
      const tagged = exception as Exception & {
        code?: string;
        _code?: string;
        meta?: Record<string, unknown>;
      };

      return {
        status: exception.status,
        body: {
          success: false,
          _message: exception.message,
          ...(typeof tagged._code === 'string' ? { _code: tagged._code } : {}),
          ...(typeof tagged.code === 'string' ? { code: tagged.code } : {}),
          ...(tagged.meta ? { meta: tagged.meta } : {}),
          ...(this.normalizeExceptionErrors(exception)),
        },
      };
    }

    return {
      status: 500,
      body: {
        success: false,
        _message: config.env === 'development' ? exception.message : 'Internal server error',
        ...(config.env === 'development' ? { stack: exception.stack } : {}),
      },
    };
  }

  private fromPrisma(exception: Prisma.PrismaClientKnownRequestError): { status: number; body: ErrorResponse } {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined) ?? [];
        const fields = target.length ? target.join(', ') : 'value';

        return {
          status: 409,
          body: {
            success: false,
            _message: `A record with this ${fields} already exists`,
            errors: target.map(field => ({ field, message: 'Already taken' })),
          },
        };
      }

      case 'P2003':
        return { status: 400, body: { success: false, _message: 'The referenced record does not exist' } };

      case 'P2025':
        return { status: 404, body: { success: false, _message: 'Record not found' } };

      default:
        return { status: 400, body: { success: false, _message: `Database request failed (${exception.code})` } };
    }
  }

  private normalizeExceptionErrors(exception: Exception): Pick<ErrorResponse, 'errors'> {
    const errors = (exception as Exception & { errors?: any[] }).errors;

    if (!Array.isArray(errors) || !errors.length) return {};

    return {
      errors: errors.map(error => ({
        field: error.instancePath?.replace(/^\//, '') || error.dataPath || '(body)',
        message: error.message ?? String(error),
      })),
    };
  }
}
