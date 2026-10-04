-- CreateEnum
CREATE TYPE "assignment_type" AS ENUM ('homework', 'exam', 'quiz', 'project');

-- CreateEnum
CREATE TYPE "grading_mode" AS ENUM ('points', 'band');

-- CreateEnum
CREATE TYPE "seat_status" AS ENUM ('active', 'dropped');

-- CreateEnum
CREATE TYPE "storage_record_type" AS ENUM ('assignment_submission');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('user', 'system', 'api_key');

-- CreateEnum
CREATE TYPE "activity_outcome" AS ENUM ('success', 'denied', 'error');

-- CreateTable
CREATE TABLE "organization_preferences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_year" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_scale" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "supersedes_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grading_scale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_scale_band" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "grading_scale_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "group_label" TEXT,
    "min_percent" DECIMAL(6,2),
    "gpa_points" DECIMAL(3,2),
    "is_passing" BOOLEAN,
    "counts_in_average" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grading_scale_band_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grading_scale_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_teacher" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_seat" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" "seat_status" NOT NULL DEFAULT 'active',
    "dropped_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "assignment_type" NOT NULL,
    "grading_mode" "grading_mode" NOT NULL DEFAULT 'points',
    "max_points" DECIMAL(7,2),
    "grading_scale_id" UUID,
    "due_at" TIMESTAMPTZ(3),
    "max_submissions" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submission" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "class_seat_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "text_content" TEXT,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points_awarded" DECIMAL(7,2),
    "grading_scale_id" UUID,
    "grade_band_id" UUID,
    "grade_label" TEXT,
    "grade_group" TEXT,
    "teacher_notes" TEXT,
    "graded_at" TIMESTAMPTZ(3),
    "graded_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_grade_event" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "points_awarded" DECIMAL(7,2),
    "max_points" DECIMAL(7,2),
    "grading_scale_id" UUID NOT NULL,
    "grade_band_id" UUID NOT NULL,
    "grade_label" TEXT NOT NULL,
    "grade_group" TEXT,
    "teacher_notes" TEXT,
    "reason" TEXT,
    "graded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_grade_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "actor_user_id" UUID,
    "actor_member_id" UUID,
    "actor_role" TEXT,
    "api_key_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "outcome" "activity_outcome" NOT NULL,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

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
    "uploaded_by_id" UUID,
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
    "deleted_by_id" UUID,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_preferences_organization_id_key" ON "organization_preferences"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_preferences_organization_id_id_key" ON "organization_preferences"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_year_organization_id_id_key" ON "academic_year"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_year_name_live" ON "academic_year"("organization_id", "name") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "term_organization_id_academic_year_id_idx" ON "term"("organization_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "term_organization_id_id_key" ON "term"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "term_name_live" ON "term"("organization_id", "academic_year_id", "name") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "grading_scale_organization_id_id_key" ON "grading_scale"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "grading_scale_name_live" ON "grading_scale"("organization_id", "name") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "grading_scale_one_default" ON "grading_scale"("organization_id") WHERE (is_default AND deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "grading_scale_band_organization_id_id_key" ON "grading_scale_band"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "grading_scale_band_organization_id_grading_scale_id_id_key" ON "grading_scale_band"("organization_id", "grading_scale_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "grading_scale_band_label_live" ON "grading_scale_band"("organization_id", "grading_scale_id", "label") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "grading_scale_band_threshold_live" ON "grading_scale_band"("organization_id", "grading_scale_id", "min_percent") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "class_organization_id_term_id_idx" ON "class"("organization_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_organization_id_id_key" ON "class"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "class_name_live" ON "class"("organization_id", "term_id", "name") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "class_teacher_organization_id_member_id_idx" ON "class_teacher"("organization_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_teacher_organization_id_id_key" ON "class_teacher"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "class_teacher_live" ON "class_teacher"("organization_id", "class_id", "member_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "class_seat_organization_id_member_id_idx" ON "class_seat"("organization_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_seat_organization_id_id_key" ON "class_seat"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "class_seat_live" ON "class_seat"("organization_id", "class_id", "member_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "assignment_organization_id_class_id_idx" ON "assignment"("organization_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_organization_id_id_key" ON "assignment"("organization_id", "id");

-- CreateIndex
CREATE INDEX "assignment_submission_organization_id_assignment_id_submitt_idx" ON "assignment_submission"("organization_id", "assignment_id", "submitted_at");

-- CreateIndex
CREATE INDEX "assignment_submission_organization_id_class_seat_id_idx" ON "assignment_submission"("organization_id", "class_seat_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submission_organization_id_id_key" ON "assignment_submission"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submission_organization_id_assignment_id_class_s_key" ON "assignment_submission"("organization_id", "assignment_id", "class_seat_id", "attempt_number");

-- CreateIndex
CREATE INDEX "submission_grade_event_organization_id_submission_id_create_idx" ON "submission_grade_event"("organization_id", "submission_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "submission_grade_event_organization_id_id_key" ON "submission_grade_event"("organization_id", "id");

-- CreateIndex
CREATE INDEX "activity_log_organization_id_resource_type_resource_id_crea_idx" ON "activity_log"("organization_id", "resource_type", "resource_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_log_organization_id_actor_user_id_created_at_idx" ON "activity_log"("organization_id", "actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_log_organization_id_created_at_idx" ON "activity_log"("organization_id", "created_at");

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
ALTER TABLE "organization_preferences" ADD CONSTRAINT "organization_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_year" ADD CONSTRAINT "academic_year_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term" ADD CONSTRAINT "term_organization_id_academic_year_id_fkey" FOREIGN KEY ("organization_id", "academic_year_id") REFERENCES "academic_year"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_scale" ADD CONSTRAINT "grading_scale_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_scale" ADD CONSTRAINT "grading_scale_organization_id_supersedes_id_fkey" FOREIGN KEY ("organization_id", "supersedes_id") REFERENCES "grading_scale"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_scale_band" ADD CONSTRAINT "grading_scale_band_organization_id_grading_scale_id_fkey" FOREIGN KEY ("organization_id", "grading_scale_id") REFERENCES "grading_scale"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_organization_id_term_id_fkey" FOREIGN KEY ("organization_id", "term_id") REFERENCES "term"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_organization_id_grading_scale_id_fkey" FOREIGN KEY ("organization_id", "grading_scale_id") REFERENCES "grading_scale"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_organization_id_class_id_fkey" FOREIGN KEY ("organization_id", "class_id") REFERENCES "class"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_organization_id_member_id_fkey" FOREIGN KEY ("organization_id", "member_id") REFERENCES "member"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_seat" ADD CONSTRAINT "class_seat_organization_id_class_id_fkey" FOREIGN KEY ("organization_id", "class_id") REFERENCES "class"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_seat" ADD CONSTRAINT "class_seat_organization_id_member_id_fkey" FOREIGN KEY ("organization_id", "member_id") REFERENCES "member"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_organization_id_class_id_fkey" FOREIGN KEY ("organization_id", "class_id") REFERENCES "class"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_organization_id_grading_scale_id_fkey" FOREIGN KEY ("organization_id", "grading_scale_id") REFERENCES "grading_scale"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submission" ADD CONSTRAINT "assignment_submission_organization_id_assignment_id_fkey" FOREIGN KEY ("organization_id", "assignment_id") REFERENCES "assignment"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submission" ADD CONSTRAINT "assignment_submission_organization_id_class_seat_id_fkey" FOREIGN KEY ("organization_id", "class_seat_id") REFERENCES "class_seat"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submission" ADD CONSTRAINT "assignment_submission_organization_id_grading_scale_id_gra_fkey" FOREIGN KEY ("organization_id", "grading_scale_id", "grade_band_id") REFERENCES "grading_scale_band"("organization_id", "grading_scale_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submission" ADD CONSTRAINT "assignment_submission_organization_id_graded_by_id_fkey" FOREIGN KEY ("organization_id", "graded_by_id") REFERENCES "member"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_grade_event" ADD CONSTRAINT "submission_grade_event_organization_id_submission_id_fkey" FOREIGN KEY ("organization_id", "submission_id") REFERENCES "assignment_submission"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_grade_event" ADD CONSTRAINT "submission_grade_event_organization_id_grading_scale_id_gr_fkey" FOREIGN KEY ("organization_id", "grading_scale_id", "grade_band_id") REFERENCES "grading_scale_band"("organization_id", "grading_scale_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_grade_event" ADD CONSTRAINT "submission_grade_event_organization_id_graded_by_id_fkey" FOREIGN KEY ("organization_id", "graded_by_id") REFERENCES "member"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_blob" ADD CONSTRAINT "storage_blob_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_blob_data" ADD CONSTRAINT "storage_blob_data_organization_id_blob_id_fkey" FOREIGN KEY ("organization_id", "blob_id") REFERENCES "storage_blob"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_attachment" ADD CONSTRAINT "storage_attachment_organization_id_blob_id_fkey" FOREIGN KEY ("organization_id", "blob_id") REFERENCES "storage_blob"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraints (not expressible in the Prisma schema)

ALTER TABLE "academic_year" ADD CONSTRAINT "academic_year_dates" CHECK ("ends_on" > "starts_on");
ALTER TABLE "term" ADD CONSTRAINT "term_dates" CHECK ("ends_on" > "starts_on");
ALTER TABLE "grading_scale_band" ADD CONSTRAINT "grading_scale_band_percent" CHECK ("min_percent" IS NULL OR "min_percent" >= 0);
ALTER TABLE "grading_scale_band" ADD CONSTRAINT "grading_scale_band_gpa" CHECK ("gpa_points" IS NULL OR "gpa_points" BETWEEN 0 AND 5);
ALTER TABLE "class_seat" ADD CONSTRAINT "class_seat_dropped" CHECK (("status" = 'dropped') = ("dropped_at" IS NOT NULL));
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_grading_mode" CHECK (
  ("grading_mode" = 'points' AND "max_points" IS NOT NULL AND "max_points" > 0)
  OR ("grading_mode" = 'band' AND "max_points" IS NULL)
);
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_max_submissions" CHECK ("max_submissions" >= 1);
ALTER TABLE "assignment_submission" ADD CONSTRAINT "submission_attempt" CHECK ("attempt_number" >= 1);
ALTER TABLE "assignment_submission" ADD CONSTRAINT "submission_grade_together" CHECK (
  ("grade_band_id" IS NULL) = ("grading_scale_id" IS NULL)
  AND ("grade_band_id" IS NULL) = ("grade_label" IS NULL)
  AND ("grade_band_id" IS NULL) = ("graded_at" IS NULL)
  AND ("grade_band_id" IS NULL) = ("graded_by_id" IS NULL)
);
ALTER TABLE "assignment_submission" ADD CONSTRAINT "submission_points" CHECK (
  "points_awarded" IS NULL OR ("grade_band_id" IS NOT NULL AND "points_awarded" >= 0)
);
ALTER TABLE "submission_grade_event" ADD CONSTRAINT "grade_event_points" CHECK (
  ("points_awarded" IS NULL OR "points_awarded" >= 0)
  AND ("max_points" IS NULL OR "max_points" > 0)
  AND ("points_awarded" IS NULL OR "max_points" IS NOT NULL)
);
ALTER TABLE "storage_blob" ADD CONSTRAINT "storage_blob_size" CHECK ("byte_size" >= 0);
ALTER TABLE "storage_blob" ADD CONSTRAINT "storage_blob_names" CHECK ("filename" <> '' AND "service_name" <> '' AND "key" <> '');
ALTER TABLE "storage_attachment" ADD CONSTRAINT "storage_attachment_name" CHECK ("name" <> '');

-- Append-only and immutable tables: the runtime role can read and add rows but never change or remove them.

REVOKE UPDATE, DELETE, TRUNCATE ON "activity_log" FROM "app_user";
REVOKE UPDATE, DELETE, TRUNCATE ON "submission_grade_event" FROM "app_user";
REVOKE UPDATE, DELETE, TRUNCATE ON "storage_blob" FROM "app_user";
REVOKE UPDATE, DELETE, TRUNCATE ON "storage_blob_data" FROM "app_user";
