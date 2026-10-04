import { knownGradeNames, UNGRADED } from "@/lib/domain/submission-filters";
import { issue, type ValidationIssue } from "@/lib/domain/validation";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/domain/pagination";
import { Prisma } from "@/lib/generated/prisma/client";
import type { RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import { validationFailed } from "@/lib/server/errors";
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

export function gradeWhere(
  grade: string | undefined,
): Prisma.AssignmentSubmissionWhereInput {
  if (grade === undefined) return {};
  if (grade.toLowerCase() === UNGRADED) return { grade_label: null };
  return {
    OR: [
      { grade_label: { equals: grade, mode: "insensitive" } },
      { grade_group: { equals: grade, mode: "insensitive" } },
    ],
  };
}

export async function listSubmissions(
  ctx: RequestContext,
  scope: Prisma.AssignmentSubmissionWhereInput,
  filters: SubmissionFilters,
  earlierIssues: ValidationIssue[] = [],
): Promise<SubmissionPage> {
  const issues = [
    ...earlierIssues,
    ...(await gradeFilterIssue(ctx.db, ctx.organization_id, filters.grade)),
  ];
  const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
  if (limit < 1 || limit > MAX_PAGE_SIZE) {
    issues.push(
      issue(
        "limit",
        "limit_out_of_range",
        `Limit must be between 1 and ${MAX_PAGE_SIZE}`,
      ),
    );
  }
  const after =
    filters.startingAfter === undefined
      ? null
      : await ctx.db.assignmentSubmission.findFirst({
          where: {
            AND: [
              { organization_id: ctx.organization_id },
              scope,
              { id: filters.startingAfter },
            ],
          },
          select: { id: true, submitted_at: true },
        });
  if (filters.startingAfter !== undefined && after === null) {
    issues.push(
      issue(
        "starting_after",
        "unknown_starting_after",
        "No submission with that id in this list",
      ),
    );
  }
  if (issues.length > 0) throw validationFailed(issues);

  const rows = await ctx.db.assignmentSubmission.findMany({
    where: {
      AND: [
        { organization_id: ctx.organization_id },
        scope,
        gradeWhere(filters.grade),
        filters.assignment === undefined
          ? {}
          : {
              assignment: {
                title: { contains: filters.assignment, mode: "insensitive" },
              },
            },
        filters.student === undefined
          ? {}
          : {
              class_seat: {
                member: {
                  user: {
                    OR: [
                      {
                        name: {
                          contains: filters.student,
                          mode: "insensitive",
                        },
                      },
                      {
                        username: {
                          contains: filters.student,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                },
              },
            },
        filters.submittedFrom === undefined
          ? {}
          : { submitted_at: { gte: filters.submittedFrom } },
        filters.submittedBefore === undefined
          ? {}
          : { submitted_at: { lt: filters.submittedBefore } },
        after === null
          ? {}
          : {
              OR: [
                { submitted_at: { lt: after.submitted_at } },
                { submitted_at: after.submitted_at, id: { lt: after.id } },
              ],
            },
      ],
    },
    include: submissionInclude,
    orderBy: [{ submitted_at: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  return {
    items: rows.slice(0, limit).map(toSubmissionView),
    hasMore: rows.length > limit,
  };
}
