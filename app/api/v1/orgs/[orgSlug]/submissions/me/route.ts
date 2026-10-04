import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/domain/pagination";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { listOwnSubmissions } from "@/modules/submissions/queries/list-own-submissions";
import { serializeSubmissionPage } from "@/modules/submissions/serializers";

const querySchema = z.strictObject({
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

export const listOwnRoute = defineRoute({
  resource: "submission",
  handle: async ({ ctx, input }) => {
    const query = input.query(querySchema);
    const url = `/api/v1/orgs/${ctx.organizationSlug}/submissions/me`;
    const page = await listOwnSubmissions(ctx, {
      grade: query.grade,
      assignment: query.assignment,
      limit: query.limit,
      startingAfter: query.starting_after,
    });
    return Response.json(serializeSubmissionPage(url, page));
  },
});

export const GET = serve(listOwnRoute);
