-- Hudud koeffitsientini olib tashlash.
--
-- Sabab: material varianti va foydalanuvchining o'z narxi kiritilgach,
-- viloyat bo'yicha qo'pol ko'paytiruvchi keraksiz bo'lib qoldi.
-- Samarqanddagi foydalanuvchi endi o'z pudratchisining haqiqiy narxini
-- yozadi — bu 0.9 koeffitsientdan aniqroq.
--
-- Saqlangan loyihalarning `estimate` JSON'i tegilmaydi: ular o'z
-- summasini saqlab qoladi. Qayta hisoblanganda esa yangi (koeffitsientsiz)
-- narxlar bo'yicha hisoblanadi.

ALTER TABLE "projects" DROP COLUMN "region_code";
DROP TABLE "region_coefs";
