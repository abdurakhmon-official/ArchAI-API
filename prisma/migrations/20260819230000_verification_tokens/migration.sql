-- Email tasdiqlash va parolni tiklash tokenlari.
--
-- Token XESHLANIB saqlanadi: baza o'g'irlansa, undagi qiymat bilan
-- hech kimning parolini tiklab bo'lmasin. Xom qiymat faqat xatga
-- tushadi va boshqa hech qayerda qolmaydi.
CREATE TYPE "VERIFICATION_PURPOSE" AS ENUM ('EMAIL', 'PASSWORD_RESET');

CREATE TABLE "verification_tokens" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "purpose"    "VERIFICATION_PURPOSE" NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- Bir foydalanuvchining ochiq tokenlarini topish: yangi so'rov
-- kelganda eskilari bekor qilinadi.
CREATE INDEX "verification_tokens_user_id_purpose_idx" ON "verification_tokens"("user_id", "purpose");

-- Muddati o'tganlarini tozalash uchun.
CREATE INDEX "verification_tokens_expires_at_idx" ON "verification_tokens"("expires_at");

ALTER TABLE "verification_tokens"
  ADD CONSTRAINT "verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
