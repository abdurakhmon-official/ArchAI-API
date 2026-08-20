import type { MessageCode } from '@/utils/messages';

export interface SelectableRoomType {
  code: string;
  selectable: boolean;
  maxCount: number;
  defaultCount: number;
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

    if (count > type.maxCount) {
      throw new RoomProgramError(
        'ROOM_MAX_COUNT',
        `"${code}" allows at most ${type.maxCount}, ${count} requested`,
        { code, max: type.maxCount, count },
      );
    }

    if (count > 0) result[code] = count;
  }

  return result;
}

export function defaultRoomProgram(types: SelectableRoomType[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const type of types) {
    if (type.selectable && type.defaultCount > 0) result[type.code] = type.defaultCount;
  }

  return result;
}
