import { Controller, Inject } from '@tsed/di';
import { BodyParams } from '@tsed/platform-params';
import { Post, Returns, Summary } from '@tsed/schema';
import {
  AddRoomInputSchema,
  ChangeRoomTypeInputSchema,
  MoveWallInputSchema,
  RemoveRoomInputSchema,
  ResizeInputSchema,
  type AddRoomInput,
  type ChangeRoomTypeInput,
  type MoveWallInput,
  type RemoveRoomInput,
  type ResizeInput,
} from '@/inputs/geometry.input';
import { RateLimit, RATE_LIMITS } from '@/middlewares/rate-limit.middleware';
import { GeometryService } from '@/services/geometry.service';

@Controller('/geometry')
export class GeometryController {
  @Inject()
  private geometryService!: GeometryService;

  @Post('/room/add')
  @(Returns(400).Description('joy yetmadi yoki xona turi noma\'lum'))
  @RateLimit(RATE_LIMITS.geometry)
  async addRoom(@BodyParams() body: AddRoomInput) {
    const input = AddRoomInputSchema.parse(body);
    const geometry = await this.geometryService.addRoom(input.geometry, input.level, input.roomType);

    return { success: true, data: geometry };
  }

  @Post('/room/remove')
  @RateLimit(RATE_LIMITS.geometry)
  async removeRoom(@BodyParams() body: RemoveRoomInput) {
    const input = RemoveRoomInputSchema.parse(body);
    const geometry = await this.geometryService.removeRoom(input.geometry, input.level, input.roomId);

    return { success: true, data: geometry };
  }

  @Post('/room/type')
  @RateLimit(RATE_LIMITS.geometry)
  async changeType(@BodyParams() body: ChangeRoomTypeInput) {
    const input = ChangeRoomTypeInputSchema.parse(body);
    const geometry = await this.geometryService.changeRoomType(
      input.geometry,
      input.level,
      input.roomId,
      input.roomType,
    );

    return { success: true, data: geometry };
  }

  @Post('/wall/move')
  @RateLimit(RATE_LIMITS.geometry)
  async moveWall(@BodyParams() body: MoveWallInput) {
    const input = MoveWallInputSchema.parse(body);
    const geometry = await this.geometryService.moveWall(
      input.geometry,
      input.level,
      input.splitId,
      input.ratio,
    );

    return { success: true, data: geometry };
  }

  @Post('/resize')
  async resize(@BodyParams() body: ResizeInput) {
    const input = ResizeInputSchema.parse(body);
    const geometry = this.geometryService.resize(input.geometry, input.width, input.length);

    return { success: true, data: geometry };
  }
}
