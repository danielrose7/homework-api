import { knownGradeNames } from "@/lib/domain/submission-filters";
import { issue, type ValidationIssue } from "@/lib/domain/validation";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/domain/pagination";
import { Prisma } from "@/lib/generated/prisma/client";
import type { RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import { validationFailed } from "@/lib/server/errors";
import {
  submissionWhere,
  type SubmissionCursor,
} from "@/modules/submissions/utils/filter-where";
import { toSubmissionView } from "@/modules/submissions/serializers";
import {
  submissionInclude,
  type SubmissionFilters,
  type SubmissionPage,
} from "@/modules/submissions/types";

async function gradeFilterIssue(
  db: DbClient,
  organization_id: string,
  grade: string | undefined,
) {
  if (grade === undefined) return [];
  const bands = await db.gradingScaleBand.findMany({
    where: { organization_id },
    select: { label: true, group_label: true },
  });
  return knownGradeNames(bands).has(grade.toLowerCase())
    ? []
    : [
        issue(
          "grade",
          "unknown_grade",
          "That grade is not used by this school",
        ),
      ];
}

function limitIssues(limit: number) {
  return limit < 1 || limit > MAX_PAGE_SIZE
    ? [
        issue(
          "limit",
          "limit_out_of_range",
          `Limit must be between 1 and ${MAX_PAGE_SIZE}`,
        ),
      ]
    : [];
}

async function resolveCursor(
  ctx: RequestContext,
  scope: Prisma.AssignmentSubmissionWhereInput,
  starting_after: string | undefined,
): Promise<{ after: SubmissionCursor | null; issues: ValidationIssue[] }> {
  if (starting_after === undefined) return { after: null, issues: [] };
  const after = await ctx.db.assignmentSubmission.findFirst({
    where: {
      AND: [
        { organization_id: ctx.organization_id },
        scope,
        { id: starting_after },
      ],
    },
    select: { id: true, submitted_at: true },
  });
  return {
    after,
    issues:
      after === null
        ? [
            issue(
              "starting_after",
              "unknown_starting_after",
              "No submission with that id in this list",
            ),
          ]
        : [],
  };
}

export async function listSubmissions(
  ctx: RequestContext,
  scope: Prisma.AssignmentSubmissionWhereInput,
  filters: SubmissionFilters,
  earlier_issues: ValidationIssue[] = [],
): Promise<SubmissionPage> {
  const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
  const { after, issues: cursorIssues } = await resolveCursor(
    ctx,
    scope,
    filters.starting_after,
  );
  const issues = [
    ...earlier_issues,
    ...(await gradeFilterIssue(ctx.db, ctx.organization_id, filters.grade)),
    ...limitIssues(limit),
    ...cursorIssues,
  ];
  if (issues.length > 0) throw validationFailed(issues);

  const rows = await ctx.db.assignmentSubmission.findMany({
    where: submissionWhere(ctx.organization_id, scope, filters, after),
    include: submissionInclude,
    orderBy: [{ submitted_at: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  return {
    items: rows.slice(0, limit).map(toSubmissionView),
    has_more: rows.length > limit,
  };
}
