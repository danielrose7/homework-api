import { createHash, randomUUID } from "node:crypto";

import {
  MAX_FILES_PER_RECORD,
  sanitizeFilename,
  validateUpload,
  type UploadInput,
} from "@/lib/domain/uploads";
import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { conflict, notFound, validationFailed } from "@/lib/server/errors";
import { loadAccessibleSubmission } from "@/lib/server/services/access";
import { DEFAULT_STORAGE_SERVICE, storageService } from "@/lib/server/storage";
import { transact } from "@/lib/server/transaction";

export interface BlobSummary {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  checksum: string;
}

/** Stores a file and returns its blob. The blob is unattached until `attachBlob` links it to a record. */
export async function createBlob(
  ctx: RequestContext,
  input: UploadInput,
): Promise<BlobSummary> {
  requirePermission(ctx, { submission: ["create"] });

  const issues = validateUpload(input);
  if (issues.length > 0) throw validationFailed(issues);

  const filename = sanitizeFilename(input.filename);
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const service = storageService(DEFAULT_STORAGE_SERVICE);

  return transact(ctx.db, async (tx) => {
    const blob = await tx.storageBlob.create({
      data: {
        organizationId: ctx.organizationId,
        key: randomUUID(),
        filename,
        contentType: input.contentType,
        byteSize: input.bytes.length,
        checksum,
        serviceName: service.name,
        uploadedById: ctx.memberId,
      },
    });
    await service.upload(
      tx,
      { organizationId: ctx.organizationId, blobId: blob.id, key: blob.key },
      input.bytes,
    );
    await recordActivity(tx, ctx, {
      action: "create",
      resourceType: "attachment",
      resourceId: blob.id,
      metadata: { byteSize: input.bytes.length },
    });
    return {
      id: blob.id,
      filename: blob.filename,
      contentType: blob.contentType,
      byteSize: blob.byteSize,
      checksum: blob.checksum,
    };
  });
}

export interface AttachInput {
  submissionId: string;
  blobId: string;
  name?: string;
}

/** Links an uploaded blob to the student's own, still ungraded, submission. */
export async function attachBlobToSubmission(
  ctx: RequestContext,
  input: AttachInput,
) {
  requirePermission(ctx, { submission: ["create"] });

  const { submission } = await loadAccessibleSubmission(
    ctx,
    input.submissionId,
  );
  if (ctx.role !== "student") throw notFound();
  if (submission.gradedAt !== null) {
    throw conflict("submission_graded", "Graded work can no longer change");
  }

  const blob = await ctx.db.storageBlob.findFirst({
    where: { id: input.blobId, organizationId: ctx.organizationId },
  });
  if (!blob) {
    throw validationFailed([issue("blobId", "not_found", "File not found")]);
  }

  const name = input.name ?? "files";
  const existing = await ctx.db.storageAttachment.findMany({
    where: {
      organizationId: ctx.organizationId,
      recordType: "assignment_submission",
      recordId: submission.id,
      name,
    },
  });
  if (existing.some((row) => row.blobId === blob.id)) {
    throw conflict("already_attached", "That file is already attached");
  }
  if (existing.length >= MAX_FILES_PER_RECORD) {
    throw validationFailed([
      issue(
        "blobId",
        "too_many_files",
        `At most ${MAX_FILES_PER_RECORD} files per submission`,
      ),
    ]);
  }

  const attachment = await ctx.db.storageAttachment.create({
    data: {
      organizationId: ctx.organizationId,
      blobId: blob.id,
      recordType: "assignment_submission",
      recordId: submission.id,
      name,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "update",
    resourceType: "submission",
    resourceId: submission.id,
    metadata: { changedFields: ["attachments"], attachmentId: attachment.id },
  });
  return { id: attachment.id, blobId: blob.id, name };
}

export async function listSubmissionAttachments(
  ctx: RequestContext,
  submissionId: string,
) {
  requirePermission(ctx, { submission: ["read"] });
  const { submission } = await loadAccessibleSubmission(ctx, submissionId);

  const attachments = await ctx.db.storageAttachment.findMany({
    where: {
      organizationId: ctx.organizationId,
      recordType: "assignment_submission",
      recordId: submission.id,
    },
    orderBy: { createdAt: "asc" },
  });
  const blobs = await ctx.db.storageBlob.findMany({
    where: {
      organizationId: ctx.organizationId,
      id: { in: attachments.map((row) => row.blobId) },
    },
    select: {
      id: true,
      filename: true,
      contentType: true,
      byteSize: true,
      checksum: true,
    },
  });
  const byId = new Map(blobs.map((blob) => [blob.id, blob]));
  return attachments.flatMap((row) => {
    const blob = byId.get(row.blobId);
    return blob ? [{ attachmentId: row.id, name: row.name, ...blob }] : [];
  });
}

export async function downloadAttachment(
  ctx: RequestContext,
  attachmentId: string,
) {
  requirePermission(ctx, { submission: ["read"] });

  const attachment = await ctx.db.storageAttachment.findFirst({
    where: { id: attachmentId, organizationId: ctx.organizationId },
  });
  if (!attachment || attachment.recordType !== "assignment_submission") {
    throw notFound();
  }
  await loadAccessibleSubmission(ctx, attachment.recordId);

  const blob = await ctx.db.storageBlob.findFirst({
    where: { id: attachment.blobId, organizationId: ctx.organizationId },
  });
  if (!blob) throw notFound();

  const bytes = await storageService(blob.serviceName).download(ctx.db, {
    organizationId: ctx.organizationId,
    blobId: blob.id,
    key: blob.key,
  });

  await recordActivity(ctx.db, ctx, {
    action: "read",
    resourceType: "attachment",
    resourceId: attachment.id,
    metadata: { submissionId: attachment.recordId },
  });
  return {
    filename: blob.filename,
    contentType: blob.contentType,
    byteSize: blob.byteSize,
    checksum: blob.checksum,
    bytes,
  };
}
