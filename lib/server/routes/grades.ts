import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { gradeEtag, parseIfMatch } from "@/lib/server/etag";
import type { RouteHandler } from "@/lib/server/route";
import { submissionJson } from "@/lib/server/routes/submissions";
import { gradeSubmission } from "@/lib/server/services/grades";
import { getSubmission } from "@/lib/server/services/submissions";

const params = z.object({ submissionId: z.uuid() });

const points = z.union([z.string(), z.number()]).transform(String);

const gradeBody = z.strictObject({
  points: points.nullish(),
  band: z.string().nullish(),
  teacher_notes: z.string().nullish(),
  reason: z.string().nullish(),
});

export const grade: RouteHandler = async ({ ctx, request, input }) => {
  const { submissionId } = input.params(params);
  const body = await input.body(gradeBody);
  const expectedGradedAt = parseIfMatch(request.headers.get("if-match"));

  await gradeSubmission(ctx, submissionId, {
    points: body.points,
    band: body.band,
    teacherNotes: body.teacher_notes,
    reason: body.reason,
    expectedGradedAt,
  });

  const submission = await getSubmission(ctx, submissionId);
  return Response.json(submissionJson(submission), {
    status: STATUS.ok,
    headers: submission.gradedAt
      ? { etag: gradeEtag(submission.gradedAt) }
      : undefined,
  });
};
