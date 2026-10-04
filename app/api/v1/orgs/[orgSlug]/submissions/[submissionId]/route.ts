import { z } from "zod";

import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { readSubmission } from "@/modules/submissions/queries/get-submission";
import { serializeSubmission } from "@/modules/submissions/serializers";

const params = z.object({ submission_id: z.uuid() });

export const getSubmissionRoute = defineRoute({
  resource: "submission",
  idParam: "submission_id",
  handle: async ({ ctx, input }) => {
    const { submission_id } = input.params(params);
    const submission = await readSubmission(ctx, submission_id);
    return Response.json(serializeSubmission(submission));
  },
});

export const GET = serve(getSubmissionRoute);
