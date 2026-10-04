import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { gradeSubmission } from "@/modules/submissions/mutations/grade-submission";
import { getSubmission } from "@/modules/submissions/queries/get-submission";
import { serializeSubmission } from "@/modules/submissions/serializers";

const params = z.object({ submissionId: z.uuid() });
const points = z.union([z.string(), z.number()]).transform(String);
const bodySchema = z.strictObject({
  points: points.nullish(),
  band: z.string().nullish(),
  teacher_notes: z.string().nullish(),
  reason: z.string().nullish(),
});

export const gradeSubmissionRoute = defineRoute({
  resource: "submission",
  idParam: "submissionId",
  handle: async ({ ctx, input }) => {
    const { submissionId } = input.params(params);
    const body = await input.body(bodySchema);

    await gradeSubmission(ctx, submissionId, {
      points: body.points,
      band: body.band,
      teacherNotes: body.teacher_notes,
      reason: body.reason,
    });

    const submission = await getSubmission(ctx, submissionId);
    return Response.json(serializeSubmission(submission), {
      status: STATUS.ok,
    });
  },
});

export const PUT = serve(gradeSubmissionRoute);
