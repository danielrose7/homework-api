import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/errors";
import { loadAccessibleSubmission } from "@/modules/submissions/queries/load-accessible-submission";
import { storageService } from "@/lib/server/storage";

export async function downloadAttachment(
  ctx: RequestContext,
  submissionId: string,
  attachmentId: string,
) {
  requirePermission(ctx, { submission: ["read"] });
  await loadAccessibleSubmission(ctx, submissionId);

  const attachment = await ctx.db.storageAttachment.findFirst({
    where: {
      id: attachmentId,
      organizationId: ctx.organizationId,
      recordType: "assignment_submission",
      recordId: submissionId,
    },
  });
  if (!attachment) throw notFound();

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
