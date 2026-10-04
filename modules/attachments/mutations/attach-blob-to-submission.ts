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
    input.submission_id,
  );
  if (ctx.role !== "student") throw deniedAsNotFound();
  if (submission.graded_at !== null) {
    throw conflict("submission_graded", "Graded work can no longer change");
  }

  const blob = await ctx.db.storageBlob.findFirst({
    where: { id: input.blob_id, organization_id: ctx.organization_id },
  });
  if (!blob) {
    throw validationFailed([issue("blob_id", "not_found", "File not found")]);
  }

  const name = input.name ?? "files";
  const existing = await ctx.db.storageAttachment.findMany({
    where: {
      organization_id: ctx.organization_id,
      record_type: "assignment_submission",
      record_id: submission.id,
      name,
    },
  });
  if (existing.some((row) => row.blob_id === blob.id)) {
    throw conflict("already_attached", "That file is already attached");
  }
  if (existing.length >= MAX_FILES_PER_RECORD) {
    throw validationFailed([
      issue(
        "blob_id",
        "too_many_files",
        `At most ${MAX_FILES_PER_RECORD} files per submission`,
      ),
    ]);
  }

  const attachment = await ctx.db.storageAttachment.create({
    data: {
      organization_id: ctx.organization_id,
      blob_id: blob.id,
      record_type: "assignment_submission",
      record_id: submission.id,
      name,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "update",
    resource_type: "submission",
    resource_id: submission.id,
    metadata: { changedFields: ["attachments"], attachmentId: attachment.id },
  });
  return { id: attachment.id, blob_id: blob.id, name };
}
