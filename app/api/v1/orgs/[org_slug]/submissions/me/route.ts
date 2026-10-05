import { z } from "zod";

import { pageQuery } from "@/lib/domain/pagination";
import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { listOwnSubmissions } from "@/modules/submissions/queries/list-own-submissions";
import { serializeSubmissionPage } from "@/modules/submissions/serializers";

const querySchema = z.strictObject({
  grade: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "A grade label or group the school uses, such as `A`, `B+`, `Pass` or `Incomplete`, or `ungraded`. Case-insensitive.",
    ),
  assignment: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Part of the assignment title. Case-insensitive."),
  ...pageQuery,
});

export const listOwnRoute = defineRoute({
  resource: "submission",
  doc: {
    id: "list_own",
    method: "GET",
    path: "/api/v1/orgs/{org_slug}/submissions/me",
    group: "Student",
    title: "My submissions",
    summary: "List your own submissions, newest first, with optional filters.",
    description:
      "Filters combine with AND. A `grade` the school does not use is a `422`, so a typo is not mistaken for an empty list.",
    roles: ["student"],
    query: querySchema,
    success: {
      status: STATUS.ok,
      description: "A list object of submissions.",
    },
    errors: [
      {
        status: STATUS.forbidden,
        code: "forbidden",
        description: "The caller is not a student.",
      },
      {
        status: STATUS.unprocessable_content,
        code: "validation_failed",
        description:
          "Detail codes include `unknown_grade` and `unknown_starting_after`, plus the shape errors for unknown or malformed parameters.",
      },
    ],
  },
  handle: async ({ ctx, input }) => {
    const query = input.query(querySchema);
    const url = `/api/v1/orgs/${ctx.organization_slug}/submissions/me`;
    const page = await listOwnSubmissions(ctx, query);
    return Response.json(serializeSubmissionPage(url, page));
  },
});

export const GET = serve(listOwnRoute);
