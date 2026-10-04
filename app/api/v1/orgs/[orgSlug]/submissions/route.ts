import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/domain/pagination";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import {
  listSubmissionsOverview,
  MIN_STUDENT_FILTER_LENGTH,
} from "@/modules/submissions/queries/list-submissions-overview";
import { serializeSubmissionPage } from "@/modules/submissions/serializers";

const querySchema = z.strictObject({
  grade: z.string().trim().min(1).optional(),
  assignment: z.string().trim().min(1).optional(),
  student: z.string().trim().min(MIN_STUDENT_FILTER_LENGTH).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  starting_after: z.uuid().optional(),
});

export const listSubmissionsRoute = defineRoute({
  resource: "submission",
  handle: async ({ ctx, input }) => {
    const query = input.query(querySchema);
    const url = `/api/v1/orgs/${ctx.organizationSlug}/submissions`;
    const page = await listSubmissionsOverview(ctx, {
      grade: query.grade,
      assignment: query.assignment,
      student: query.student,
      from: query.from,
      to: query.to,
      limit: query.limit,
      startingAfter: query.starting_after,
    });
    return Response.json(serializeSubmissionPage(url, page));
  },
});

export const GET = serve(listSubmissionsRoute);
