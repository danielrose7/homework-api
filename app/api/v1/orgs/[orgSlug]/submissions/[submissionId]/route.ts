import { z } from "zod";

import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { readSubmission } from "@/modules/submissions/queries/get-submission";
import { serializeSubmission } from "@/modules/submissions/serializers";

const params = z.object({ submissionId: z.uuid() });

export const getSubmissionRoute = defineRoute({
  resource: "submission",
  idParam: "submissionId",
  handle: async ({ ctx, input }) => {
    const { submissionId } = input.params(params);
    const submission = await readSubmission(ctx, submissionId);
    return Response.json(serializeSubmission(submission));
  },
});

export const GET = serve(getSubmissionRoute);
