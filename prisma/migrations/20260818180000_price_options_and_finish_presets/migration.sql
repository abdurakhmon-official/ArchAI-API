-- Material variantlari va pardoz to'plamlari.
--
-- Narx endi ikki qatlamli: `price_items` nima o'lchanishini belgilaydi,
-- `price_options` esa qaysi material qancha turishini. Pardoz darajasi
-- ko'paytiruvchi bo'lishdan to'xtaydi va material to'plamiga aylanadi —
-- material tanlangach ko'paytirish ikki marta hisoblash bo'lardi.

-- 1. Material variantlari
CREATE TABLE "price_options" (
    "id" TEXT NOT NULL,
    "price_item_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "image_url" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_options_price_item_id_idx" ON "price_options"("price_item_id");
CREATE UNIQUE INDEX "price_options_price_item_id_code_key" ON "price_options"("price_item_id", "code");

ALTER TABLE "price_options"
    ADD CONSTRAINT "price_options_price_item_id_fkey"
    FOREIGN KEY ("price_item_id") REFERENCES "price_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Pardoz darajasi: ko'paytiruvchi o'rniga material to'plami
ALTER TABLE "finish_levels" ADD COLUMN "defaults" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "finish_levels" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "finish_levels" DROP COLUMN "coefficient";

-- 3. Foydalanuvchining material tanlovi
--
-- Mavjud loyihalarda `NULL` — ya'ni ular pardoz to'plamidagi sukutdagi
-- materiallardan foydalanadi. Saqlangan `estimate` JSON'i tegilmaydi,
-- shuning uchun eski loyihalarning summasi qayta hisoblangunicha
-- o'zgarmaydi.
ALTER TABLE "projects" ADD COLUMN "estimate_selection" JSONB;
