import { requirePermission, type RequestContext } from "@/lib/server/context";
import { loadAccessibleSubmission } from "@/modules/submissions/queries/load-accessible-submission";
import type { AttachmentSummary } from "@/modules/attachments/types";

export async function listSubmissionAttachments(
  ctx: RequestContext,
  submission_id: string,
): Promise<AttachmentSummary[]> {
  requirePermission(ctx, { submission: ["read"] });
  const { submission } = await loadAccessibleSubmission(ctx, submission_id);

  const attachments = await ctx.db.storageAttachment.findMany({
    where: {
      organization_id: ctx.organization_id,
      record_type: "assignment_submission",
      record_id: submission.id,
    },
    orderBy: { created_at: "asc" },
  });
  const blobs = await ctx.db.storageBlob.findMany({
    where: {
      organization_id: ctx.organization_id,
      id: { in: attachments.map((row) => row.blob_id) },
    },
    select: {
      id: true,
      filename: true,
      content_type: true,
      byte_size: true,
      checksum: true,
    },
  });
  const byId = new Map(blobs.map((blob) => [blob.id, blob]));
  return attachments.flatMap((row) => {
    const blob = byId.get(row.blob_id);
    return blob ? [{ attachmentId: row.id, name: row.name, ...blob }] : [];
  });
}
