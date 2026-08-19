import { Prisma } from '../generated/prisma';

const toPlain = (row: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(JSON.stringify(row)) as Record<string, unknown>;

const jsonOrNull = <T>(value: T | null | undefined): T | typeof Prisma.DbNull | undefined => {
  if (value === undefined) return undefined;
  return value === null ? Prisma.DbNull : value;
};

export { toPlain, jsonOrNull };
