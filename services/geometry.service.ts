import type { GeometryContext, GeometryOutcome } from '@/types/geometry.types';
import { Inject, Injectable } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { drawFloor, toSvg } from '@/geometry/drawing';
import { buildHouse, pickStairs } from '@/geometry/layout';
import { moveSplit } from '@/geometry/resize';
import { addRoom, changeRoomType, GeometryError, removeRoom, renameRoom } from '@/geometry/split';
import { validateHouse } from '@/geometry/validate';
import type { ExtraRequest } from '@/geometry/extras';
import type { House, Rect, RoomTypeRule, TreeNode, ValidationResult } from '@/geometry/types';
import type { GeometryState } from '@/inputs/geometry.input';
import {
  EstimateService,
  type EstimateResult,
  type EstimateSelection,
} from '@/services/estimate.service';
import { RoomTypeService } from '@/services/room-type.service';
import { StyleService } from '@/services/style.service';
import type { StyleConfig } from '@/types/style.types';

@Injectable()
export class GeometryService {
  @Inject()
  private roomTypeService!: RoomTypeService;

  @Inject()
  private styleService!: StyleService;

  @Inject()
  private estimateService!: EstimateService;

  async context(styleSlug?: string): Promise<GeometryContext> {
    const [rules, names, styles] = await Promise.all([
      this.roomTypeService.rules(),
      this.roomTypeService.names(),
      this.styleService.configsFor(styleSlug),
    ]);

    if (styles.length === 0) {
      throw new BadRequest('no published styles available');
    }

    return { rules, names, style: styles[0] };
  }

  toHouse(geometry: GeometryState, context: GeometryContext): House {
    const bounds = geometry.bounds as Rect;
    const trees = [...geometry.floors]
      .sort((first, second) => first.level - second.level)
      .map((floor) => floor.tree as TreeNode);

    if (trees.length === 0) throw new BadRequest('geometry has no floors');

    const stairs = trees.length > 1 ? pickStairs(trees[0], bounds) : undefined;

    const { house } = buildHouse(
      {
        bounds,
        floors: trees.map((tree, index) => ({ level: index + 1, tree, stairs })),
        roof: context.style.roof,
        extras: geometry.extras as ExtraRequest[] | undefined,
      },
      { rules: context.rules, layout: context.style.layout },
    );

    return house;
  }

  async evaluate(
    geometry: GeometryState,
    finishLevel: string,
    selection: EstimateSelection = {},
    context?: GeometryContext,
  ): Promise<GeometryOutcome> {
    const ctx = context ?? (await this.context(geometry.styleSlug));
    const house = this.toHouse(geometry, ctx);

    const validation = validateHouse(house, {
      rules: ctx.rules,
      minAreaFactor: ctx.style.layout.minAreaFactor,
    });

    const estimate = await this.estimateService.forHouse(house, finishLevel, selection);

    const coverSvg = toSvg(
      drawFloor(house.floors[0], { names: ctx.names, showDimensions: false, extras: house.extras }),
      { scale: 26, showLabels: false },
    );

    return { geometry, validation, estimate, coverSvg };
  }

  async addRoom(geometry: GeometryState, level: number, roomType: string): Promise<GeometryState> {
    const ctx = await this.context(geometry.styleSlug);

    return this.mutate(geometry, level, (tree, bounds) =>
      addRoom(tree, bounds, roomType, {
        rules: ctx.rules,
        minAreaFactor: ctx.style.layout.minAreaFactor,
      }),
    );
  }

  async removeRoom(geometry: GeometryState, level: number, roomId: string): Promise<GeometryState> {
    return this.mutate(geometry, level, (tree) => removeRoom(tree, roomId));
  }

  async changeRoomType(
    geometry: GeometryState,
    level: number,
    roomId: string,
    roomType: string,
  ): Promise<GeometryState> {
    const ctx = await this.context(geometry.styleSlug);

    if (!ctx.rules[roomType]) {
      throw new BadRequest(`unknown room type: ${roomType}`);
    }

    return this.mutate(geometry, level, (tree) => changeRoomType(tree, roomId, roomType));
  }

  async renameRoom(
    geometry: GeometryState,
    level: number,
    roomId: string,
    label: string,
  ): Promise<GeometryState> {
    return this.mutate(geometry, level, (tree) => renameRoom(tree, roomId, label));
  }

  async moveWall(
    geometry: GeometryState,
    level: number,
    splitId: string,
    ratio: number,
  ): Promise<GeometryState> {
    const ctx = await this.context(geometry.styleSlug);

    return this.mutate(geometry, level, (tree, bounds) =>
      moveSplit(tree, splitId, ratio, bounds, {
        rules: ctx.rules,
        minAreaFactor: ctx.style.layout.minAreaFactor,
      }),
    );
  }

  resize(geometry: GeometryState, width: number, length: number): GeometryState {
    return {
      ...geometry,
      bounds: { ...geometry.bounds, width, length },
    };
  }

  private mutate(
    geometry: GeometryState,
    level: number,
    operation: (tree: TreeNode, bounds: Rect) => TreeNode,
  ): GeometryState {
    const bounds = geometry.bounds as Rect;
    const index = geometry.floors.findIndex((floor) => floor.level === level);

    if (index === -1) throw new BadRequest(`floor ${level} not found`);

    try {
      const floors = geometry.floors.map((floor, position) =>
        position === index ? { ...floor, tree: operation(floor.tree as TreeNode, bounds) } : floor,
      );

      return { ...geometry, floors };
    } catch (error) {
      if (error instanceof GeometryError) {
        throw new BadRequest(error.message);
      }
      throw error;
    }
  }
}
