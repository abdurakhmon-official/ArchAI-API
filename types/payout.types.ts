import type { PAYMENT_PROVIDER } from '../generated/prisma';

interface PayoutCardInput {
  provider: PAYMENT_PROVIDER;
  label: string;
  last4: string;
  holder: string;
  expiry: string;
  account_id: string;
}

export type { PayoutCardInput };
