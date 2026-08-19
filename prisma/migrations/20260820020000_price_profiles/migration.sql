-- Foydalanuvchining o'z narxlari.
--
-- Materiallar tanlovi hozir LOYIHAGA bog'langan: pudratchisining
-- narxlarini bilgan odam har yangi loyihada ularni qaytadan kiritishi
-- kerak edi. Bu jadval o'sha tanlovni saqlab, qayta ishlatishga imkon
-- beradi.
CREATE TABLE "price_profiles" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "selection"  JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "price_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_profiles_user_id_idx" ON "price_profiles"("user_id");

ALTER TABLE "price_profiles"
  ADD CONSTRAINT "price_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
