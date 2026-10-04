import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/domain/pagination";
import { STATUS } from "@/lib/http-status";
import { validationFailed } from "@/lib/server/errors";
import { listJson } from "@/lib/server/list-json";
import type { RequestContext } from "@/lib/server/context";
import { defineRoute } from "@/lib/server/route";
import { attachmentJson } from "@/lib/server/routes/attachments";
import {
  readSubmission,
  listOwnSubmissions,
  listSubmissionsOverview,
  MIN_STUDENT_FILTER_LENGTH,
  submitAssignment,
  type SubmissionPage,
  type SubmissionView,
} from "@/lib/server/services/submissions";
import type { UploadInput } from "@/lib/domain/uploads";

export const orgPath = (ctx: RequestContext) =>
  `/api/v1/orgs/${ctx.organizationSlug}`;

export function submissionJson(view: SubmissionView) {
  return {
    id: view.id,
    object: "submission" as const,
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

export function pageJson(url: string, page: SubmissionPage) {
  return listJson(url, page.items.map(submissionJson), page.hasMore);
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

export const submit = defineRoute({
  resource: "assignment",
  idParam: "assignmentId",
  handle: async ({ ctx, request, input }) => {
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
    const base = orgPath(ctx);
    return Response.json(
      {
        ...submissionJson(result.submission),
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

const listQuery = z.strictObject({
  grade: z.string().trim().min(1).optional(),
  assignment: z.string().trim().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  starting_after: z.uuid().optional(),
});

export const listMine = defineRoute({
  resource: "submission",
  handle: async ({ ctx, input }) => {
    const query = input.query(listQuery);
    return Response.json(
      pageJson(
        `${orgPath(ctx)}/submissions/me`,
        await listOwnSubmissions(ctx, {
          grade: query.grade,
          assignment: query.assignment,
          limit: query.limit,
          startingAfter: query.starting_after,
        }),
      ),
    );
  },
});

const overviewQuery = listQuery.extend({
  student: z.string().trim().min(MIN_STUDENT_FILTER_LENGTH).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const listAll = defineRoute({
  resource: "submission",
  handle: async ({ ctx, input }) => {
    const query = input.query(overviewQuery);
    return Response.json(
      pageJson(
        `${orgPath(ctx)}/submissions`,
        await listSubmissionsOverview(ctx, {
          grade: query.grade,
          assignment: query.assignment,
          student: query.student,
          from: query.from,
          to: query.to,
          limit: query.limit,
          startingAfter: query.starting_after,
        }),
      ),
    );
  },
});

const submissionParams = z.object({ submissionId: z.uuid() });

export const getOne = defineRoute({
  resource: "submission",
  idParam: "submissionId",
  handle: async ({ ctx, input }) => {
    const { submissionId } = input.params(submissionParams);
    const submission = await readSubmission(ctx, submissionId);
    return Response.json(submissionJson(submission));
  },
});
