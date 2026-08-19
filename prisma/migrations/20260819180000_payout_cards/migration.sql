-- Admin obuna to'lovlari qaysi hisobga tushishini boshqarish uchun.
--
-- To'liq karta raqami saqlanmaydi (PCI DSS talabi) — faqat oxirgi 4
-- raqam. Har provayder uchun bittagina faol karta bo'lishi kerak; buni
-- servis (`payout-card.service.ts`) tranzaksiya ichida ta'minlaydi.
CREATE TABLE "payout_cards" (
  "id"         TEXT NOT NULL,
  "provider"   "PAYMENT_PROVIDER" NOT NULL,
  "label"      TEXT NOT NULL,
  "last4"      TEXT NOT NULL,
  "holder"     TEXT NOT NULL,
  "expiry"     TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "active"     BOOLEAN NOT NULL DEFAULT false,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payout_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payout_cards_provider_active_idx" ON "payout_cards"("provider", "active");
