-- Admin izohi.
--
-- `message` ustuni MIJOZ yozgan matn — uni admin o'zgartirmasligi
-- kerak, aks holda murojaatning asl mazmuni yo'qoladi. Ish jarayonidagi
-- qaydlar ("qo'ng'iroq qilindi, ertaga qayta bog'lanamiz") shu yerda
-- turadi.
ALTER TABLE "leads" ADD COLUMN "admin_note" TEXT;
