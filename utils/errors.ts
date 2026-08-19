import { BadRequest, Conflict, Exception, Forbidden, NotFound, Unauthorized } from '@tsed/exceptions';
import type { MessageCode } from '@/utils/messages';

/**
 * Errors that carry a translation code.
 *
 * The English `message` is a fallback for logs and for API clients that
 * are not the web app. What the person actually reads is chosen by the
 * browser from `_code`, so a Russian user never sees an English string.
 *
 * `meta` holds the values a translation interpolates — counts, plan
 * codes, limits. Putting them in the message alone would make the
 * sentence untranslatable.
 */

type Meta = Record<string, unknown>;

const tag = <E extends Exception>(error: E, code: MessageCode, meta?: Meta): E => {
  Object.assign(error, { _code: code, ...(meta ? { meta } : {}) });
  return error;
};

const badRequest = (code: MessageCode, message: string, meta?: Meta) =>
  tag(new BadRequest(message), code, meta);

const unauthorized = (code: MessageCode, message: string, meta?: Meta) =>
  tag(new Unauthorized(message), code, meta);

const forbidden = (code: MessageCode, message: string, meta?: Meta) =>
  tag(new Forbidden(message), code, meta);

const notFound = (code: MessageCode, message: string, meta?: Meta) =>
  tag(new NotFound(message), code, meta);

const conflict = (code: MessageCode, message: string, meta?: Meta) =>
  tag(new Conflict(message), code, meta);

export { badRequest, unauthorized, forbidden, notFound, conflict, tag };
export type { Meta };
