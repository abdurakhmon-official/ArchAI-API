-- Xona uchun afzal tomonlar.
--
-- Yotoqxona sharqqa (ertalabki quyosh), mehmonxona janubga (kun bo'yi
-- yorug'), sanuzel va omborga yorug'lik kerak emas. Bu ro'yxat KODDA
-- emas, bazada: xona turlari admin tomonidan boshqariladi va yangi
-- tur qo'shilganda uni ham sozlash mumkin bo'lishi kerak.
--
-- Bo'sh massiv — "farqi yo'q".
ALTER TABLE "room_types" ADD COLUMN "sun_sides" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "room_types" SET "sun_sides" = ARRAY['east', 'south']  WHERE "code" = 'bedroom';
UPDATE "room_types" SET "sun_sides" = ARRAY['south', 'west']  WHERE "code" = 'living';
UPDATE "room_types" SET "sun_sides" = ARRAY['east', 'north']  WHERE "code" = 'kitchen';
UPDATE "room_types" SET "sun_sides" = ARRAY['south', 'east']  WHERE "code" = 'dining';
UPDATE "room_types" SET "sun_sides" = ARRAY['north', 'east']  WHERE "code" = 'office';
UPDATE "room_types" SET "sun_sides" = ARRAY['north']          WHERE "code" IN ('bathroom', 'laundry', 'storage');
