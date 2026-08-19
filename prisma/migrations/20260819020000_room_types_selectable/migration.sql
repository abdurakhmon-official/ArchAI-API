-- Xona turlarini konstruktorda so'raladigan qilish.
--
-- `selectable` sukut bo'yicha `false`: yangi tur qo'shilsa u
-- konstruktorda o'z-o'zidan paydo bo'lmaydi — admin uni ataylab yoqadi.
-- Quyida mavjud beshta tur yoqiladi, ya'ni hozirgi xatti-harakat
-- o'zgarmaydi.

ALTER TABLE "room_types" ADD COLUMN "selectable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "room_types" ADD COLUMN "max_count" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "room_types" ADD COLUMN "default_count" INTEGER NOT NULL DEFAULT 0;

-- Konstruktorda hozir so'ralayotgan beshta tur. Chegaralar
-- `RoomCountsSchema` dagi qiymatlardan olingan, shunda migratsiyadan
-- keyin hech narsa o'zgarmaydi.
UPDATE "room_types" SET "selectable" = true, "max_count" = 8, "default_count" = 2 WHERE "code" = 'bedroom';
UPDATE "room_types" SET "selectable" = true, "max_count" = 3, "default_count" = 1 WHERE "code" = 'living';
UPDATE "room_types" SET "selectable" = true, "max_count" = 5, "default_count" = 1 WHERE "code" = 'bathroom';
UPDATE "room_types" SET "selectable" = true, "max_count" = 3, "default_count" = 0 WHERE "code" = 'office';
UPDATE "room_types" SET "selectable" = true, "max_count" = 2, "default_count" = 0 WHERE "code" = 'dining';
