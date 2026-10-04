/*
  Warnings:

  - You are about to drop the `submission_attachment` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "storage_record_type" AS ENUM ('assignment_submission');

-- DropForeignKey
ALTER TABLE "submission_attachment" DROP CONSTRAINT "submission_attachment_organization_id_submission_id_fkey";

-- DropTable
DROP TABLE "submission_attachment";

-- DropEnum
DROP TYPE "storage_backend";

-- CreateTable
CREATE TABLE "storage_blob" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_blob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_blob_data" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "blob_id" UUID NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_blob_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_attachment" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "blob_id" UUID NOT NULL,
    "record_type" "storage_record_type" NOT NULL,
    "record_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_blob_organization_id_id_key" ON "storage_blob"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_blob_organization_id_key_key" ON "storage_blob"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "storage_blob_data_organization_id_id_key" ON "storage_blob_data"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_blob_data_organization_id_blob_id_key" ON "storage_blob_data"("organization_id", "blob_id");

-- CreateIndex
CREATE INDEX "storage_attachment_organization_id_record_type_record_id_idx" ON "storage_attachment"("organization_id", "record_type", "record_id");

-- CreateIndex
CREATE INDEX "storage_attachment_organization_id_blob_id_idx" ON "storage_attachment"("organization_id", "blob_id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_attachment_organization_id_id_key" ON "storage_attachment"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "storage_attachment_live" ON "storage_attachment"("organization_id", "record_type", "record_id", "name", "blob_id") WHERE (deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "storage_blob" ADD CONSTRAINT "storage_blob_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_blob_data" ADD CONSTRAINT "storage_blob_data_organization_id_blob_id_fkey" FOREIGN KEY ("organization_id", "blob_id") REFERENCES "storage_blob"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_attachment" ADD CONSTRAINT "storage_attachment_organization_id_blob_id_fkey" FOREIGN KEY ("organization_id", "blob_id") REFERENCES "storage_blob"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraints (not expressible in the Prisma schema)

ALTER TABLE "storage_blob" ADD CONSTRAINT "storage_blob_size" CHECK ("byte_size" >= 0);
ALTER TABLE "storage_blob" ADD CONSTRAINT "storage_blob_names" CHECK ("filename" <> '' AND "service_name" <> '' AND "key" <> '');
ALTER TABLE "storage_attachment" ADD CONSTRAINT "storage_attachment_name" CHECK ("name" <> '');

-- Blobs and their bytes are immutable: the runtime role can add and read them but never change or remove them.

REVOKE UPDATE, DELETE, TRUNCATE ON "storage_blob" FROM "app_user";
REVOKE UPDATE, DELETE, TRUNCATE ON "storage_blob_data" FROM "app_user";
