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
