-- CreateEnum
CREATE TYPE "MEDIA_TYPE" AS ENUM ('IMAGE', 'MODEL', 'DOCUMENT');

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "type" "MEDIA_TYPE" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_key_key" ON "media"("key");

-- CreateIndex
CREATE INDEX "media_type_idx" ON "media"("type");

-- CreateIndex
CREATE INDEX "media_uploaded_by_idx" ON "media"("uploaded_by");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
