-- CreateEnum
CREATE TYPE "EXPORT_KIND" AS ENUM ('PDF', 'RENDER', 'DWG');

-- CreateTable
CREATE TABLE "project_exports" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "EXPORT_KIND" NOT NULL DEFAULT 'PDF',
    "storage_key" TEXT NOT NULL,
    "geometry_hash" TEXT NOT NULL,
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "size_bytes" INTEGER,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_exports_expires_at_idx" ON "project_exports"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_exports_project_id_kind_geometry_hash_watermark_key" ON "project_exports"("project_id", "kind", "geometry_hash", "watermark");

-- AddForeignKey
ALTER TABLE "project_exports" ADD CONSTRAINT "project_exports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
