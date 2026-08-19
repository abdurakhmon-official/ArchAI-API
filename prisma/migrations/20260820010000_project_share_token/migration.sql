-- Ulashish havolasi.
--
-- Token NULL bo'lsa loyiha ulashilmagan. Uni o'chirish havolani darhol
-- o'lik qiladi — foydalanuvchi fikridan qaytsa, yuborilgan havola
-- ishlamay qolishi kerak.
ALTER TABLE "projects" ADD COLUMN "share_token" TEXT;

CREATE UNIQUE INDEX "projects_share_token_key" ON "projects"("share_token");
