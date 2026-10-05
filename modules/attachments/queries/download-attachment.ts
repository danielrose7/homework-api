import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/errors";
import { loadAccessibleSubmission } from "@/modules/submissions/utils/load-accessible-submission";
import { storageService } from "@/lib/server/storage";

export async function downloadAttachment(
  ctx: RequestContext,
  submission_id: string,
  attachment_id: string,
) {
  requirePermission(ctx, { submission: ["read"] });
  await loadAccessibleSubmission(ctx, submission_id);

  const attachment = await ctx.db.storageAttachment.findFirst({
    where: {
      id: attachment_id,
      organization_id: ctx.organization_id,
      record_type: "assignment_submission",
      record_id: submission_id,
    },
  });
  if (!attachment) throw notFound();

  const blob = await ctx.db.storageBlob.findFirst({
    where: { id: attachment.blob_id, organization_id: ctx.organization_id },
  });
  if (!blob) throw notFound();

  const bytes = await storageService(blob.service_name).download(ctx.db, {
    organization_id: ctx.organization_id,
    blob_id: blob.id,
    key: blob.key,
  });

  await recordActivity(ctx.db, ctx, {
    action: "read",
    resource_type: "attachment",
    resource_id: attachment.id,
    metadata: { submission_id: attachment.record_id },
  });

  return {
    filename: blob.filename,
    content_type: blob.content_type,
    byte_size: blob.byte_size,
    checksum: blob.checksum,
    bytes,
  };
}
