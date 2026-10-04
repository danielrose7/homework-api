import { createHash, randomUUID } from "node:crypto";

import {
  sanitizeFilename,
  validateUpload,
  type UploadInput,
} from "@/lib/domain/uploads";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { validationFailed } from "@/lib/server/errors";
import { DEFAULT_STORAGE_SERVICE, storageService } from "@/lib/server/storage";
import { transact } from "@/lib/server/transaction";
import type { BlobSummary } from "@/modules/attachments/types";

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
        organization_id: ctx.organization_id,
        key: randomUUID(),
        filename,
        content_type: input.content_type,
        byte_size: input.bytes.length,
        checksum,
        service_name: service.name,
        uploaded_by_id: ctx.member_id,
      },
    });
    await service.upload(
      tx,
      { organization_id: ctx.organization_id, blob_id: blob.id, key: blob.key },
      input.bytes,
    );
    await recordActivity(tx, ctx, {
      action: "create",
      resource_type: "attachment",
      resource_id: blob.id,
      metadata: { byte_size: input.bytes.length },
    });
    return {
      id: blob.id,
      filename: blob.filename,
      content_type: blob.content_type,
      byte_size: blob.byte_size,
      checksum: blob.checksum,
    };
  });
}
