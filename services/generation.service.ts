import { Inject, Injectable } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { GenerateInputRefined, type GenerateInput } from '@/inputs/generation.input';
import { PriceService } from '@/services/price.service';
import { RoomTypeService } from '@/services/room-type.service';
import { SkeletonService } from '@/services/skeleton.service';
import { StyleService } from '@/services/style.service';
import {
  generateVariants,
  type GenerationResult,
  type Variant,
  type VariantFloor,
} from '@/shared/generate';
import { badRequest } from '@/utils/errors';
import { assertRoomProgram, defaultRoomProgram, RoomProgramError } from '@/utils/room-program';

export type { GenerationResult, Variant, VariantFloor };

@Injectable()
export class GenerationService {
  @Inject()
  private roomTypeService!: RoomTypeService;

  @Inject()
  private styleService!: StyleService;

  @Inject()
  private skeletonService!: SkeletonService;

  @Inject()
  private priceService!: PriceService;

  async generate(input: GenerateInput): Promise<GenerationResult> {
    const params = GenerateInputRefined.parse(input) as GenerateInput;

    const [rules, names, styles, book, selectable, skeletons] = await Promise.all([
      this.roomTypeService.rules(),
      this.roomTypeService.names(),
      this.styleService.configsFor(params.styleSlug),
      this.priceService.book(params.finishLevel),
      this.roomTypeService.selectable(),
      this.skeletonService.published(),
    ]);

    if (styles.length === 0) {
      throw new BadRequest('no published styles available — seed the catalog first');
    }

    let rooms: Record<string, number>;
    try {
      rooms = Object.keys(params.rooms).length
        ? assertRoomProgram(params.rooms, selectable.data)
        : defaultRoomProgram(selectable.data);
    } catch (error) {
      if (error instanceof RoomProgramError) throw badRequest(error.code, error.message, error.values);
      throw error;
    }

    return generateVariants({ ...params, rooms }, skeletons, styles, { rules, names, book });
  }
}
