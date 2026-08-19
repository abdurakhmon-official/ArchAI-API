import { Injectable, Inject } from '@tsed/di';
import {
  computeEstimate,
  type EstimateResult,
  type EstimateSelection,
} from '@/shared/pricing';
import { PriceService, type PriceBook } from '@/services/price.service';
import type { House } from '@/geometry/types';

export { computeEstimate } from '@/shared/pricing';
export type {
  EstimateLine,
  EstimateResult,
  EstimateSelection,
  LineSelection,
} from '@/shared/pricing';

@Injectable()
export class EstimateService {
  @Inject()
  private priceService!: PriceService;

  async forHouse(
    house: House,
    finishLevel: string,
    selection: EstimateSelection = {},
  ): Promise<EstimateResult> {
    const book = await this.priceService.book(finishLevel);
    return computeEstimate(house, book, selection);
  }

  compute(house: House, book: PriceBook, selection: EstimateSelection = {}): EstimateResult {
    return computeEstimate(house, book, selection);
  }
}
