import { requirePermission, type RequestContext } from "@/lib/server/context";
import { loadAccessibleSubmission } from "@/lib/server/services/access";
import type { AttachmentSummary } from "@/modules/attachments/types";

export async function listSubmissionAttachments(
  ctx: RequestContext,
  submissionId: string,
): Promise<AttachmentSummary[]> {
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
