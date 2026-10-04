import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { readSubmission } from "@/modules/submissions/queries/get-submission";
import { serializeSubmission } from "@/modules/submissions/serializers";

const params = z.object({
  submission_id: z.uuid().describe("The submission to read."),
});

export const getSubmissionRoute = defineRoute({
  resource: "submission",
  id_param: "submission_id",
  doc: {
    id: "get",
    method: "GET",
    path: "/api/v1/orgs/{org_slug}/submissions/{submission_id}",
    group: "Shared",
    title: "Get a submission",
    summary:
      "Read one submission: the assignment, student, dates, grade and teacher notes.",
    description:
      "Students read their own, teachers the classes they teach, administrators any in the school. A read of a single record is written to the activity log.",
    roles: ["student", "teacher", "administrator"],
    params,
    success: { status: STATUS.ok, description: "The submission." },
    errors: [
      {
        status: STATUS.not_found,
        code: "not_found",
        description:
          "No such submission, or one the caller may not see. The two look the same on purpose.",
      },
    ],
  },
  handle: async ({ ctx, input }) => {
    const { submission_id } = input.params(params);
    const submission = await readSubmission(ctx, submission_id);
    return Response.json(serializeSubmission(submission));
  },
});

export const GET = serve(getSubmissionRoute);
