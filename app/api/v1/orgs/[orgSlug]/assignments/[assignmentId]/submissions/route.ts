import { z } from "zod";

import type { UploadInput } from "@/lib/domain/uploads";
import { STATUS } from "@/lib/http-status";
import { validationFailed } from "@/lib/server/errors";
import { listJson } from "@/lib/server/list-json";
import { defineRoute } from "@/lib/server/route";
import { attachmentJson } from "@/lib/server/routes/attachments";
import { serve } from "@/lib/server/serve";
import { submitAssignment } from "@/modules/submissions/mutations/submit-assignment";
import { serializeSubmission } from "@/modules/submissions/serializers";

const jsonSubmission = z.strictObject({ text: z.string() });
const multipartSubmission = z.object({
  text: z.string().optional(),
  files: z.array(z.instanceof(File)),
});
const params = z.object({ assignmentId: z.uuid() });

function blankToNull(text: string | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

async function toUpload(file: File): Promise<UploadInput> {
  return {
    filename: file.name,
    // Multipart file types can include parameters absent from the allow-list.
    contentType: (file.type.split(";")[0] ?? "").trim().toLowerCase(),
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export const submitRoute = defineRoute({
  resource: "assignment",
  idParam: "assignmentId",
  handle: async ({ ctx, request, input }) => {
    const { assignmentId } = input.params(params);
    const isMultipart = (request.headers.get("content-type") ?? "").startsWith(
      "multipart/form-data",
    );

    let text: string | null;
    let files: UploadInput[] = [];
    if (isMultipart) {
      const form = await request.formData().catch(() => {
        throw validationFailed([
          {
            field: "",
            code: "invalid_multipart",
            message: "Request body is not valid multipart form data",
          },
        ]);
      });
      const parsed = input.parse(multipartSubmission, {
        text: form.get("text") ?? undefined,
        files: form.getAll("files"),
      });
      text = blankToNull(parsed.text);
      files = await Promise.all(parsed.files.map(toUpload));
    } else {
      text = blankToNull((await input.body(jsonSubmission)).text);
    }

    const result = await submitAssignment(ctx, assignmentId, { text, files });
    const base = `/api/v1/orgs/${ctx.organizationSlug}`;
    return Response.json(
      {
        ...serializeSubmission(result.submission),
        attachments: listJson(
          `${base}/submissions/${result.submission.id}/attachments`,
          result.attachments.map(attachmentJson),
        ),
      },
      {
        status: STATUS.created,
        headers: { location: `${base}/submissions/${result.submission.id}` },
      },
    );
  },
});

export const POST = serve(submitRoute);
