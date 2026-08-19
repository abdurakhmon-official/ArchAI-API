-- CreateEnum
CREATE TYPE "USER_ROLE" AS ENUM ('ADMIN', 'ARCHITECT', 'USER');

-- CreateEnum
CREATE TYPE "CONTENT_STATUS" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PRICE_CATEGORY" AS ENUM ('FOUNDATION', 'WALLS', 'ROOF', 'WINDOWS_DOORS', 'FINISHING', 'UTILITIES', 'OTHER');

-- CreateEnum
CREATE TYPE "SUBSCRIPTION_STATUS" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PAYMENT_PROVIDER" AS ENUM ('PAYME', 'CLICK', 'STRIPE');

-- CreateEnum
CREATE TYPE "PAYMENT_STATUS" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LEAD_STATUS" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "USER_ROLE" NOT NULL DEFAULT 'USER',
    "phone" TEXT,
    "avatar" TEXT,
    "region" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "styles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "roof" JSONB NOT NULL,
    "facade" JSONB NOT NULL,
    "window" JSONB NOT NULL,
    "interior" JSONB NOT NULL,
    "layout_rules" JSONB NOT NULL,
    "furniture_sets" JSONB,
    "preview_url" TEXT,
    "status" "CONTENT_STATUS" NOT NULL DEFAULT 'DRAFT',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "styles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "min_area" DOUBLE PRECISION NOT NULL,
    "max_area" DOUBLE PRECISION NOT NULL,
    "ideal_ratio" DOUBLE PRECISION NOT NULL DEFAULT 1.4,
    "needs_exterior_wall" BOOLEAN NOT NULL DEFAULT true,
    "is_wet_zone" BOOLEAN NOT NULL DEFAULT false,
    "access_from" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "furniture_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skeletons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL DEFAULT 1,
    "tree" JSONB NOT NULL,
    "tag_bedrooms" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "tag_styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_width" DOUBLE PRECISION NOT NULL,
    "max_width" DOUBLE PRECISION NOT NULL,
    "min_length" DOUBLE PRECISION NOT NULL,
    "max_length" DOUBLE PRECISION NOT NULL,
    "status" "CONTENT_STATUS" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skeletons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "furniture_assets" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "gltf_url" TEXT NOT NULL,
    "thumb_url" TEXT,
    "room_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "style_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "footprint" JSONB NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'WALL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "furniture_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_items" (
    "id" TEXT NOT NULL,
    "category" "PRICE_CATEGORY" NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "measure" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "region_coefs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "region_coefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finish_levels" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finish_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "style_id" TEXT,
    "skeleton_id" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "params" JSONB NOT NULL,
    "geometry" JSONB NOT NULL,
    "estimate" JSONB,
    "estimate_total" DECIMAL(14,2),
    "finish_level" TEXT NOT NULL DEFAULT 'standard',
    "region_code" TEXT NOT NULL DEFAULT 'tashkent',
    "cover_svg" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_versions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "params" JSONB NOT NULL,
    "estimate_total" DECIMAL(14,2),
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "price_uzs" DECIMAL(14,2) NOT NULL,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "limits" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SUBSCRIPTION_STATUS" NOT NULL DEFAULT 'PENDING',
    "provider" "PAYMENT_PROVIDER",
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "provider" "PAYMENT_PROVIDER" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "status" "PAYMENT_STATUS" NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT NOT NULL,
    "raw" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "excerpt" JSONB,
    "body" JSONB NOT NULL,
    "cover_url" TEXT,
    "category_id" TEXT,
    "author_id" TEXT,
    "status" "CONTENT_STATUS" NOT NULL DEFAULT 'DRAFT',
    "views" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "question" JSONB NOT NULL,
    "answer" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'contact',
    "payload" JSONB,
    "status" "LEAD_STATUS" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "diff" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "styles_slug_key" ON "styles"("slug");

-- CreateIndex
CREATE INDEX "styles_status_idx" ON "styles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "room_types_code_key" ON "room_types"("code");

-- CreateIndex
CREATE INDEX "skeletons_floors_status_idx" ON "skeletons"("floors", "status");

-- CreateIndex
CREATE UNIQUE INDEX "price_items_code_key" ON "price_items"("code");

-- CreateIndex
CREATE INDEX "price_items_category_idx" ON "price_items"("category");

-- CreateIndex
CREATE UNIQUE INDEX "region_coefs_code_key" ON "region_coefs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "finish_levels_code_key" ON "finish_levels"("code");

-- CreateIndex
CREATE INDEX "projects_user_id_deleted_at_idx" ON "projects"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "project_versions_project_id_created_at_idx" ON "project_versions"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_external_id_key" ON "payments"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at");

-- CreateIndex
CREATE INDEX "faq_items_category_idx" ON "faq_items"("category");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "styles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
