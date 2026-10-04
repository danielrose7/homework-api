import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { downloadAttachment } from "@/modules/attachments/queries/download-attachment";

const params = z.object({
  submission_id: z.uuid().describe("The submission the file belongs to."),
  attachment_id: z.uuid().describe("The attachment to download."),
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
  id_param: "attachment_id",
  doc: {
    id: "download_attachment",
    method: "GET",
    path: "/api/v1/orgs/{org_slug}/submissions/{submission_id}/attachments/{attachment_id}",
    group: "Shared",
    title: "Download an attachment",
    summary: "Download one attached file as it was uploaded.",
    description:
      "The response body is the file itself, with its original `Content-Type` and a `Content-Disposition: attachment` header. Same access rules as the submission; every download is written to the activity log.",
    roles: ["student", "teacher", "administrator"],
    params,
    success: { status: STATUS.ok, description: "The file's bytes." },
    errors: [
      {
        status: STATUS.not_found,
        code: "not_found",
        description:
          "No such attachment on that submission, or a submission the caller may not see.",
      },
    ],
  },
  handle: async ({ ctx, input }) => {
    const { submission_id, attachment_id } = input.params(params);
    const file = await downloadAttachment(ctx, submission_id, attachment_id);

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
