import { instantsForDayRange, validateDayRange } from "@/lib/domain/local-days";
import { issue, type ValidationIssue } from "@/lib/domain/validation";
import type { Prisma } from "@/lib/generated/prisma/client";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { listSubmissions } from "@/modules/submissions/queries/list-submissions";
import type {
  SubmissionFilters,
  SubmissionPage,
} from "@/modules/submissions/types";

export interface OverviewFilters extends Omit<
  SubmissionFilters,
  "submitted_from" | "submitted_before"
> {
  from?: string;
  to?: string;
}

export const MIN_STUDENT_FILTER_LENGTH = 2;

function validateOverviewFilters(filters: OverviewFilters): ValidationIssue[] {
  const issues = validateDayRange(filters);
  if (
    filters.student !== undefined &&
    filters.student.length < MIN_STUDENT_FILTER_LENGTH
  ) {
    issues.push(
      issue(
        "student",
        "student_too_short",
        `Type at least ${MIN_STUDENT_FILTER_LENGTH} characters of the name`,
      ),
    );
  }
  return issues;
}

function visibleScope(
  ctx: RequestContext,
): Prisma.AssignmentSubmissionWhereInput {
  if (ctx.role === "administrator") return {};
  return {
    assignment: {
      class: {
        teachers: { some: { member_id: ctx.member_id, deleted_at: null } },
      },
    },
  };
}

export async function listSubmissionsOverview(
  ctx: RequestContext,
  filters: OverviewFilters,
): Promise<SubmissionPage> {
  requirePermission(ctx, { submission: ["readAll"] });
  const { timezone } = await ctx.db.organizationPreferences.findUniqueOrThrow({
    where: { organization_id: ctx.organization_id },
  });
  const { from, before } = instantsForDayRange(filters, timezone);

  const submissionFilters: SubmissionFilters = {
    grade: filters.grade,
    assignment: filters.assignment,
    student: filters.student,
    limit: filters.limit,
    starting_after: filters.starting_after,
    ...(from ? { submitted_from: from } : {}),
    ...(before ? { submitted_before: before } : {}),
  };

  return listSubmissions(
    ctx,
    visibleScope(ctx),
    submissionFilters,
    validateOverviewFilters(filters),
  );
}
