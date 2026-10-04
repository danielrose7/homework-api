import { z } from "zod";

import { MAX_TEXT_LENGTH } from "@/lib/domain/submission";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_FILES_PER_RECORD,
  MAX_UPLOAD_BYTES,
  type UploadInput,
} from "@/lib/domain/uploads";
import { STATUS } from "@/lib/http-status";
import { validationFailed } from "@/lib/server/errors";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { submitAssignment } from "@/modules/submissions/mutations/submit-assignment";
import { serializeSubmittedSubmission } from "@/modules/submissions/serializers";

const textField = z
  .string()
  .describe(
    `The written answer, at most ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters. Blank text counts as none.`,
  );
const jsonSubmission = z.strictObject({ text: textField });
const multipartSubmission = z.object({
  text: textField.optional(),
  files: z
    .array(z.instanceof(File))
    .describe(
      `Repeat the field for each file: at most ${MAX_FILES_PER_RECORD}, ${MAX_UPLOAD_BYTES / 1024 / 1024} MB each.`,
    ),
});
const params = z.object({
  assignment_id: z.uuid().describe("The assignment being handed in."),
});

function blankToNull(text: string | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

async function toUpload(file: File): Promise<UploadInput> {
  return {
    filename: file.name,
    // Multipart file types can include parameters absent from the allow-list.
    content_type: (file.type.split(";")[0] ?? "").trim().toLowerCase(),
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export const submitRoute = defineRoute({
  resource: "assignment",
  id_param: "assignment_id",
  doc: {
    id: "submit",
    method: "POST",
    path: "/api/v1/orgs/{org_slug}/assignments/{assignment_id}/submissions",
    group: "Student",
    title: "Submit homework",
    summary:
      "Hand in text, files, or both for an assignment in one of your classes.",
    description: `Send JSON with \`text\`, or \`multipart/form-data\` with \`text\` and repeated \`files\` fields. Attachments cannot be added after submitting. Each assignment allows one submission by default, so a second try is a \`409\`.

Allowed file types: ${ALLOWED_CONTENT_TYPES.map((type) => `\`${type}\``).join(", ")}. The bytes must match the declared type. The \`201\` response carries a \`Location\` header pointing at the new submission.`,
    roles: ["student"],
    params,
    bodies: [
      { content_type: "application/json", schema: jsonSubmission },
      { content_type: "multipart/form-data", schema: multipartSubmission },
    ],
    success: {
      status: STATUS.created,
      description:
        "The submission, with `grade` null and its `attachments` as a list.",
    },
    errors: [
      {
        status: STATUS.forbidden,
        code: "forbidden",
        description: "The caller is not a student.",
      },
      {
        status: STATUS.forbidden,
        code: "seat_not_active",
        description: "The student's seat in the class has been dropped.",
      },
      {
        status: STATUS.not_found,
        code: "not_found",
        description:
          "No such assignment, or one in a class the student does not attend.",
      },
      {
        status: STATUS.conflict,
        code: "submission_limit_reached",
        description: "The assignment's submission limit is used up.",
      },
      {
        status: STATUS.unprocessable_content,
        code: "validation_failed",
        description:
          "Detail codes: `content_required`, `text_too_long`, `too_many_files`, `filename_required`, `file_empty`, `file_too_large`, `content_type_not_allowed`, `content_type_mismatch`. File problems name the file, as `files.1.file`.",
      },
    ],
  },
  handle: async ({ ctx, request, input }) => {
    const { assignment_id } = input.params(params);
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

    const result = await submitAssignment(ctx, assignment_id, { text, files });
    const base = `/api/v1/orgs/${ctx.organization_slug}`;
    return Response.json(
      serializeSubmittedSubmission(
        result.submission,
        `${base}/submissions/${result.submission.id}/attachments`,
        result.attachments,
      ),
      {
        status: STATUS.created,
        headers: { location: `${base}/submissions/${result.submission.id}` },
      },
    );
  },
});

export const POST = serve(submitRoute);
