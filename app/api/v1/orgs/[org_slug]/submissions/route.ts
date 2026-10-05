import { z } from "zod";

import { pageQuery } from "@/lib/domain/pagination";
import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import {
  listSubmissionsOverview,
  MIN_STUDENT_FILTER_LENGTH,
} from "@/modules/submissions/queries/list-submissions-overview";
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
  student: z
    .string()
    .trim()
    .min(MIN_STUDENT_FILTER_LENGTH)
    .optional()
    .describe(
      "Part of the student's display name or username. Case-insensitive.",
    ),
  from: z.iso
    .date()
    .optional()
    .describe(
      "First day to include, as `YYYY-MM-DD` in the school's time zone.",
    ),
  to: z.iso
    .date()
    .optional()
    .describe(
      "Last day to include, as `YYYY-MM-DD` in the school's time zone. Not before `from`.",
    ),
  ...pageQuery,
});

export const listSubmissionsRoute = defineRoute({
  resource: "submission",
  doc: {
    id: "list_overview",
    method: "GET",
    path: "/api/v1/orgs/{org_slug}/submissions",
    group: "Teacher",
    title: "Submissions overview",
    summary:
      "List submissions across classes, newest first, filtered by assignment, student, date range or grade.",
    description:
      "Teachers see the classes they teach; administrators see the whole school. `from` and `to` are calendar days, both inclusive, read in the school's time zone rather than UTC.",
    roles: ["teacher", "administrator"],
    query: querySchema,
    success: {
      status: STATUS.ok,
      description: "A list object of submissions.",
    },
    errors: [
      {
        status: STATUS.forbidden,
        code: "forbidden",
        description: "The caller is a student.",
      },
      {
        status: STATUS.unprocessable_content,
        code: "validation_failed",
        description:
          "Detail codes include `date_range_inverted`, `unknown_grade` and `unknown_starting_after`, plus the shape errors for unknown or malformed parameters.",
      },
    ],
  },
  handle: async ({ ctx, input }) => {
    const query = input.query(querySchema);
    const url = `/api/v1/orgs/${ctx.organization_slug}/submissions`;
    const page = await listSubmissionsOverview(ctx, query);
    return Response.json(serializeSubmissionPage(url, page));
  },
});

export const GET = serve(listSubmissionsRoute);
