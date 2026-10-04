import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/domain/pagination";
import { STATUS } from "@/lib/http-status";
import { validationFailed } from "@/lib/server/errors";
import type { RouteHandler } from "@/lib/server/route";
import {
  listOwnSubmissions,
  submitAssignment,
  type SubmissionPage,
  type SubmissionView,
} from "@/lib/server/services/submissions";
import type { UploadInput } from "@/lib/domain/uploads";

export function submissionJson(view: SubmissionView) {
  return {
    id: view.id,
    assignment: view.assignment,
    student: {
      member_id: view.student.memberId,
      name: view.student.name,
      username: view.student.username,
    },
    attempt_number: view.attemptNumber,
    text: view.text,
    submitted_at: view.submittedAt.toISOString(),
    graded_at: view.gradedAt?.toISOString() ?? null,
    teacher_notes: view.teacherNotes,
    grade:
      view.grade === null
        ? null
        : {
            label: view.grade.label,
            group: view.grade.group,
            points_awarded: view.grade.pointsAwarded,
            max_points: view.grade.maxPoints,
            percent: view.grade.percent,
            scale_id: view.grade.scaleId,
          },
  };
}

export function pageJson(page: SubmissionPage) {
  return {
    data: page.items.map(submissionJson),
    next_cursor: page.nextCursor,
  };
}

const jsonSubmission = z.strictObject({ text: z.string() });

const multipartSubmission = z.object({
  text: z.string().optional(),
  files: z.array(z.instanceof(File)),
});

const assignmentParams = z.object({ assignmentId: z.uuid() });

function blankToNull(text: string | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

/** File parts report their type with parameters such as `; charset=utf-8`, which the allow-list does not carry. */
async function toUpload(file: File): Promise<UploadInput> {
  return {
    filename: file.name,
    contentType: (file.type.split(";")[0] ?? "").trim().toLowerCase(),
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export const submit: RouteHandler = async ({ ctx, request, input }) => {
  const { assignmentId } = input.params(assignmentParams);
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
  return Response.json(
    {
      ...submissionJson(result.submission),
      attachments: result.attachments.map((attachment) => ({
        id: attachment.attachmentId,
        filename: attachment.filename,
        content_type: attachment.contentType,
        byte_size: attachment.byteSize,
      })),
    },
    {
      status: STATUS.created,
      headers: {
        location: `/api/v1/orgs/${ctx.organizationSlug}/submissions/${result.submission.id}`,
      },
    },
  );
};

const listQuery = z.strictObject({
  grade: z.string().trim().min(1).optional(),
  assignment: z.string().trim().min(1).optional(),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).optional(),
});

export const listMine: RouteHandler = async ({ ctx, input }) => {
  const query = input.query(listQuery);
  return Response.json(
    pageJson(
      await listOwnSubmissions(ctx, {
        grade: query.grade,
        assignment: query.assignment,
        pageSize: query.page_size,
        cursor: query.cursor,
      }),
    ),
  );
};
