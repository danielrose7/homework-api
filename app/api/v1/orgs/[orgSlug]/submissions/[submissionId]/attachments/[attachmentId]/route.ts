import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { downloadAttachment } from "@/modules/attachments/queries/download-attachment";

const params = z.object({
  submission_id: z.uuid(),
  attachmentId: z.uuid(),
});

// Keep an ASCII fallback for old clients and the exact name for RFC 5987 clients.
function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export const downloadAttachmentRoute = defineRoute({
  resource: "attachment",
  idParam: "attachmentId",
  handle: async ({ ctx, input }) => {
    const { submission_id, attachmentId } = input.params(params);
    const file = await downloadAttachment(ctx, submission_id, attachmentId);

    return new Response(new Uint8Array(file.bytes), {
      status: STATUS.ok,
      headers: {
        "content-type": file.content_type,
        "content-length": String(file.byte_size),
        "content-disposition": contentDisposition(file.filename),
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  },
});

export const GET = serve(downloadAttachmentRoute);
