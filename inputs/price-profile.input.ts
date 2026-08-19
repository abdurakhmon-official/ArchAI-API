import { z } from 'zod';
import { EstimateSelectionSchema } from '@/inputs/estimate.input';

const PriceProfileInputSchema = z.object({
  name: z.string().min(1).max(60),
  selection: EstimateSelectionSchema,
});

type PriceProfileInput = z.infer<typeof PriceProfileInputSchema>;

export { PriceProfileInputSchema };
export type { PriceProfileInput };
