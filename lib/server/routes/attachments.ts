import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import {
  downloadAttachment,
  listSubmissionAttachments,
} from "@/lib/server/services/attachments";

type AttachmentSummary = Awaited<
  ReturnType<typeof listSubmissionAttachments>
>[number];

export function attachmentJson(attachment: AttachmentSummary) {
  return {
    id: attachment.attachmentId,
    filename: attachment.filename,
    content_type: attachment.contentType,
    byte_size: attachment.byteSize,
    checksum: attachment.checksum,
  };
}

const listParams = z.object({ submissionId: z.uuid() });
const downloadParams = listParams.extend({ attachmentId: z.uuid() });

export const list = defineRoute({
  resource: "submission",
  idParam: "submissionId",
  handle: async ({ ctx, input }) => {
    const { submissionId } = input.params(listParams);
    const attachments = await listSubmissionAttachments(ctx, submissionId);
    return Response.json({ data: attachments.map(attachmentJson) });
  },
});

/** An ASCII `filename` for old clients plus the exact name as RFC 5987 `filename*`. */
function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export const download = defineRoute({
  resource: "attachment",
  idParam: "attachmentId",
  handle: async ({ ctx, input }) => {
    const { submissionId, attachmentId } = input.params(downloadParams);
    const file = await downloadAttachment(ctx, submissionId, attachmentId);

    return new Response(new Uint8Array(file.bytes), {
      status: STATUS.ok,
      headers: {
        "content-type": file.contentType,
        "content-length": String(file.byteSize),
        "content-disposition": contentDisposition(file.filename),
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  },
});
