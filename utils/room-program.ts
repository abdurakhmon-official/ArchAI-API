import type { MessageCode } from '@/utils/messages';

export interface SelectableRoomType {
  code: string;
  selectable: boolean;
  max_count: number;
  default_count: number;
}

export class RoomProgramError extends Error {
  constructor(
    readonly code: MessageCode,
    message: string,
    readonly values: Record<string, string | number> = {},
  ) {
    super(message);
  }
}

export function assertRoomProgram(
  requested: Record<string, number>,
  types: SelectableRoomType[],
): Record<string, number> {
  const byCode = new Map(types.map((type) => [type.code, type]));
  const result: Record<string, number> = {};

  for (const [code, count] of Object.entries(requested)) {
    const type = byCode.get(code);

    if (!type) {
      throw new RoomProgramError('ROOM_UNKNOWN_TYPE', `unknown room type: "${code}"`, { code });
    }

    if (!type.selectable) {
      throw new RoomProgramError('ROOM_NOT_SELECTABLE', `"${code}" cannot be requested in the constructor`, { code });
    }

    if (count > type.max_count) {
      throw new RoomProgramError(
        'ROOM_MAX_COUNT',
        `"${code}" allows at most ${type.max_count}, ${count} requested`,
        { code, max: type.max_count, count },
      );
    }

    if (count > 0) result[code] = count;
  }

  return result;
}

export function defaultRoomProgram(types: SelectableRoomType[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const type of types) {
    if (type.selectable && type.default_count > 0) result[type.code] = type.default_count;
  }

  return result;
}
