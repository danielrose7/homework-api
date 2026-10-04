import { MAX_FILES_PER_RECORD } from "@/lib/domain/uploads";
import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import {
  conflict,
  deniedAsNotFound,
  validationFailed,
} from "@/lib/server/errors";
import { loadAccessibleSubmission } from "@/modules/submissions/queries/load-accessible-submission";
import type { AttachInput } from "@/modules/attachments/types";

export async function attachBlobToSubmission(
  ctx: RequestContext,
  input: AttachInput,
) {
  requirePermission(ctx, { submission: ["create"] });

  const { submission } = await loadAccessibleSubmission(
    ctx,
    input.submissionId,
  );
  if (ctx.role !== "student") throw deniedAsNotFound();
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
