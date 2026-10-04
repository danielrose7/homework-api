import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { gradeSubmission } from "@/modules/submissions/mutations/grade-submission";
import { getSubmission } from "@/modules/submissions/queries/get-submission";
import { serializeSubmission } from "@/modules/submissions/serializers";

const params = z.object({
  submission_id: z.uuid().describe("The submission to grade."),
});
const points = z.union([z.string(), z.number()]).transform(String);
const bodySchema = z.strictObject({
  points: points
    .nullish()
    .describe(
      "Points earned, 0 up to the assignment's `max_points`, with at most two decimals. The school's scale turns it into a grade. For assignments graded in points.",
    ),
  band: z
    .string()
    .nullish()
    .describe(
      "A band name from the scale, such as `Pass`, `Fail` or `Incomplete`. Send it instead of `points` for assignments graded by band; `Incomplete` is also allowed on points assignments.",
    ),
  teacher_notes: z
    .string()
    .nullish()
    .describe("Comments for the student, at most 5,000 characters."),
  reason: z
    .string()
    .nullish()
    .describe(
      "Why the grade is changing, at most 1,000 characters. Required when replacing a grade; optional when replacing `Incomplete`.",
    ),
});

export const gradeSubmissionRoute = defineRoute({
  resource: "submission",
  id_param: "submission_id",
  doc: {
    id: "grade",
    method: "PUT",
    path: "/api/v1/orgs/{org_slug}/submissions/{submission_id}/grade",
    group: "Teacher",
    title: "Grade a submission",
    summary:
      "Set the current grade and teacher notes; a regrade needs a reason.",
    description:
      "Idempotent: the body replaces the current grade. The resolved grade (label, group, percent and the scale used) is stored with the submission, and every change is kept in its grade history, so editing a scale later never relabels past work. A regrade is last-write-wins.",
    roles: ["teacher", "administrator"],
    params,
    bodies: [{ content_type: "application/json", schema: bodySchema }],
    success: {
      status: STATUS.ok,
      description: "The updated submission, with its `grade` object.",
    },
    errors: [
      {
        status: STATUS.forbidden,
        code: "forbidden",
        description: "The caller is a student.",
      },
      {
        status: STATUS.not_found,
        code: "not_found",
        description:
          "No such submission, or one in a class the teacher does not teach.",
      },
      {
        status: STATUS.unprocessable_content,
        code: "validation_failed",
        description:
          "Every problem is returned at once. Detail codes: `grade_required`, `ambiguous_grade`, `invalid_number`, `exceeds_max_points`, `points_not_allowed`, `unknown_band`, `band_not_manual`, `reason_required`, `too_long`.",
      },
    ],
  },
  handle: async ({ ctx, input }) => {
    const { submission_id } = input.params(params);
    const body = await input.body(bodySchema);

    await gradeSubmission(ctx, submission_id, {
      points: body.points,
      band: body.band,
      teacher_notes: body.teacher_notes,
      reason: body.reason,
    });

    const submission = await getSubmission(ctx, submission_id);
    return Response.json(serializeSubmission(submission), {
      status: STATUS.ok,
    });
  },
});

export const PUT = serve(gradeSubmissionRoute);
