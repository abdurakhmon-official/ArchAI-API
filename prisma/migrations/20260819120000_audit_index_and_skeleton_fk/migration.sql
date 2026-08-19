-- Audit jurnali indekslari, andoza tashqi kaliti va `users.region` qoldig'i.

-- 1. Audit jurnali har doim vaqt bo'yicha saralanadi va sahifalanadi;
--    filtr esa `actor_id` bo'yicha. Indekssiz jadval kattalashgach har
--    sahifa to'liq saralashni talab qilardi.
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- 2. `projects.skeleton_id` tashqi kalitsiz `String?` edi. Andoza
--    o'chirilganda loyihalar mavjud bo'lmagan yozuvga ishora qilib
--    qolardi — baza darajasida hech narsa to'smasdi.
--
--    Kalit qo'shishdan OLDIN yetim havolalar tozalanadi, aks holda
--    migratsiya yiqiladi.
UPDATE "projects"
SET "skeleton_id" = NULL
WHERE "skeleton_id" IS NOT NULL
  AND "skeleton_id" NOT IN (SELECT "id" FROM "skeletons");

ALTER TABLE "projects" ADD CONSTRAINT "projects_skeleton_id_fkey"
    FOREIGN KEY ("skeleton_id") REFERENCES "skeletons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. `users.region` — hududlar olib tashlangandan keyin (Faza 3) qolgan
--    ustun. Hech qayerda o'qilmaydi.
ALTER TABLE "users" DROP COLUMN IF EXISTS "region";
