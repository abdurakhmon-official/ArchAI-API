interface PaymeTransactionState {
  state: number;
  create_time: number;
  perform_time: number;
  cancel_time: number;
  reason: number | null;
  subscription_id: string;
  months: number;
}

export type { PaymeTransactionState };
