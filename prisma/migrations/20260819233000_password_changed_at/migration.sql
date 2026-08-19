-- Parol oxirgi marta qachon o'zgargani.
--
-- Nima uchun: JWT bekor qilinmaydi va bitta `jti` ni qora ro'yxatga
-- qo'yish faqat O'SHA tokenga ta'sir qiladi. Parolni tiklashning eng
-- ko'p uchraydigan sababi esa hisobga birov kirib qolgani — u odamda
-- boshqa token bor va u ishlab turaveradi.
--
-- Shu sana bilan solishtirib, undan OLDIN berilgan barcha tokenlar
-- rad etiladi. Bitta ustun bilan butun sessiyalar to'plami uziladi.
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
