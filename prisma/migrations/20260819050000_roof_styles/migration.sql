-- Tom uslublari — admin qo'shadigan nomlangan presetlar.
--
-- Shakl (`family`) koddan keladi va admin uni ko'paytira olmaydi: har
-- bir shakl uchun `geometry/roof.ts` da alohida geometriya kerak. Preset
-- esa cheksiz — bir xil shakldan turlicha qiyalik, chiqish va qoplama
-- bilan o'nlab uslub chiqadi.
--
-- Ikkita yangi shakl kodda ham qo'shildi: `pyramid` va `mansard`.

CREATE TYPE "ROOF_FAMILY" AS ENUM ('flat', 'shed', 'gable', 'hip', 'pyramid', 'mansard');

CREATE TABLE "roof_styles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "family" "ROOF_FAMILY" NOT NULL,
    "pitch" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "overhang" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "upper_pitch" DOUBLE PRECISION,
    "break_ratio" DOUBLE PRECISION,
    "covering_id" TEXT,
    "color" TEXT,
    "preview_url" TEXT,
    "status" "CONTENT_STATUS" NOT NULL DEFAULT 'DRAFT',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roof_styles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roof_styles_code_key" ON "roof_styles"("code");
CREATE INDEX "roof_styles_status_idx" ON "roof_styles"("status");

-- Qoplama o'chirilsa preset qolsin va bazaviy narxga tushsin.
ALTER TABLE "roof_styles" ADD CONSTRAINT "roof_styles_covering_id_fkey"
    FOREIGN KEY ("covering_id") REFERENCES "price_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Uslub presetga havola qiladi. `Style.roof` JSON'i zaxira sifatida
-- qoladi: eski uslublar va preset o'chirilgan holat uchun.
ALTER TABLE "styles" ADD COLUMN "roof_style_id" TEXT;

ALTER TABLE "styles" ADD CONSTRAINT "styles_roof_style_id_fkey"
    FOREIGN KEY ("roof_style_id") REFERENCES "roof_styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
