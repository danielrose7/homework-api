import { percentOf } from "@/lib/domain/grading";
import {
  decodeCursor,
  encodeCursor,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/lib/domain/pagination";
import { instantsForDayRange, validateDayRange } from "@/lib/domain/local-days";
import { issue, type ValidationIssue } from "@/lib/domain/validation";
import {
  submissionEligibility,
  validateSubmissionContent,
  type EligibilityResult,
  type SubmissionContent,
} from "@/lib/domain/submission";
import { knownGradeNames, UNGRADED } from "@/lib/domain/submission-filters";
import { Prisma } from "@/lib/generated/prisma/client";
import { STATUS } from "@/lib/http-status";
import { recordActivity } from "@/lib/server/activity";
import {
  requirePermission,
  requireRole,
  type RequestContext,
} from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import {
  ApiError,
  conflict,
  deniedAsNotFound,
  notFound,
  validationFailed,
} from "@/lib/server/errors";
import { loadAccessibleSubmission } from "@/lib/server/services/access";
import {
  attachBlobToSubmission,
  createBlob,
  listSubmissionAttachments,
} from "@/lib/server/services/attachments";
import { transact } from "@/lib/server/transaction";

const submissionInclude = {
  assignment: { select: { id: true, title: true, maxPoints: true } },
  classSeat: {
    select: {
      member: {
        select: { id: true, user: { select: { name: true, username: true } } },
      },
    },
  },
} satisfies Prisma.AssignmentSubmissionInclude;

type SubmissionRow = Prisma.AssignmentSubmissionGetPayload<{
  include: typeof submissionInclude;
}>;

export interface SubmissionView {
  id: string;
  assignment: { id: string; title: string };
  student: { memberId: string; name: string; username: string | null };
  attemptNumber: number;
  text: string | null;
  submittedAt: Date;
  gradedAt: Date | null;
  teacherNotes: string | null;
  grade: {
    label: string;
    group: string | null;
    pointsAwarded: string | null;
    maxPoints: string | null;
    percent: string | null;
    scaleId: string | null;
  } | null;
}

export function toSubmissionView(row: SubmissionRow): SubmissionView {
  const pointsAwarded = row.pointsAwarded?.toFixed(2) ?? null;
  const maxPoints = row.assignment.maxPoints?.toFixed(2) ?? null;
  const { member } = row.classSeat;

  return {
    id: row.id,
    assignment: { id: row.assignment.id, title: row.assignment.title },
    student: {
      memberId: member.id,
      name: member.user.name,
      username: member.user.username,
    },
    attemptNumber: row.attemptNumber,
    text: row.textContent,
    submittedAt: row.submittedAt,
    gradedAt: row.gradedAt,
    teacherNotes: row.teacherNotes,
    grade:
      row.gradeLabel === null
        ? null
        : {
            label: row.gradeLabel,
            group: row.gradeGroup,
            pointsAwarded,
            maxPoints: pointsAwarded === null ? null : maxPoints,
            percent:
              pointsAwarded !== null && maxPoints !== null
                ? percentOf(pointsAwarded, maxPoints)
                : null,
            scaleId: row.gradingScaleId,
          },
  };
}

function eligibilityError(failure: Extract<EligibilityResult, { ok: false }>) {
  switch (failure.status) {
    case STATUS.not_found:
      return notFound();
    case STATUS.forbidden:
      return new ApiError(
        STATUS.forbidden,
        failure.code,
        "You are not actively enrolled in this class",
        [],
        true,
      );
    case STATUS.conflict:
      return conflict(
        failure.code,
        "You have used all your submissions for this assignment",
      );
  }
}

export type SubmitInput = SubmissionContent;

export async function submitAssignment(
  ctx: RequestContext,
  assignmentId: string,
  input: SubmitInput,
) {
  requirePermission(ctx, { submission: ["create"] });

  const issues = validateSubmissionContent(input);
  if (issues.length > 0) throw validationFailed(issues);

  try {
    return await transact(ctx.db, async (tx) => {
      const inTransaction = { ...ctx, db: tx };

      const assignment = await tx.assignment.findFirst({
        where: { id: assignmentId, organizationId: ctx.organizationId },
      });
      if (!assignment) throw notFound();
      const seat = await tx.classSeat.findFirst({
        where: {
          organizationId: ctx.organizationId,
          classId: assignment.classId,
          memberId: ctx.memberId,
        },
      });
      if (!seat) throw deniedAsNotFound();

      const eligibility = submissionEligibility({
        assignment,
        seat,
        attemptsSoFar: await tx.assignmentSubmission.count({
          where: {
            organizationId: ctx.organizationId,
            assignmentId: assignment.id,
            classSeatId: seat.id,
          },
        }),
      });
      if (!eligibility.ok) throw eligibilityError(eligibility);

      const created = await tx.assignmentSubmission.create({
        data: {
          organizationId: ctx.organizationId,
          assignmentId: assignment.id,
          classSeatId: seat.id,
          attemptNumber: eligibility.attemptNumber,
          textContent: input.text,
        },
        include: submissionInclude,
      });
      for (const file of input.files) {
        const blob = await createBlob(inTransaction, file);
        await attachBlobToSubmission(inTransaction, {
          submissionId: created.id,
          blobId: blob.id,
        });
      }
      await recordActivity(tx, ctx, {
        action: "create",
        resourceType: "submission",
        resourceId: created.id,
        metadata: {
          assignmentId: assignment.id,
          attemptNumber: created.attemptNumber,
          attachmentCount: input.files.length,
        },
      });

      return {
        submission: toSubmissionView(created),
        attachments: await listSubmissionAttachments(inTransaction, created.id),
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw conflict(
        "submission_limit_reached",
        "Another submission for this assignment was saved at the same time",
      );
    }
    throw error;
  }
}

export interface SubmissionFilters {
  grade?: string;
  assignment?: string;
  student?: string;
  submittedFrom?: Date;
  submittedBefore?: Date;
  pageSize?: number;
  cursor?: string;
}

export interface SubmissionPage {
  items: SubmissionView[];
  nextCursor: string | null;
}

async function gradeFilterIssue(
  db: DbClient,
  organizationId: string,
  grade: string | undefined,
) {
  if (grade === undefined) return [];
  const bands = await db.gradingScaleBand.findMany({
    where: { organizationId },
    select: { label: true, groupLabel: true },
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
  if (grade.toLowerCase() === UNGRADED) return { gradeLabel: null };
  return {
    OR: [
      { gradeLabel: { equals: grade, mode: "insensitive" } },
      { gradeGroup: { equals: grade, mode: "insensitive" } },
    ],
  };
}

export async function runSubmissionQuery(
  ctx: RequestContext,
  scope: Prisma.AssignmentSubmissionWhereInput,
  filters: SubmissionFilters,
  earlierIssues: ValidationIssue[] = [],
): Promise<SubmissionPage> {
  const issues = [
    ...earlierIssues,
    ...(await gradeFilterIssue(ctx.db, ctx.organizationId, filters.grade)),
  ];
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    issues.push(
      issue(
        "page_size",
        "page_size_out_of_range",
        `Page size must be between 1 and ${MAX_PAGE_SIZE}`,
      ),
    );
  }
  const cursor =
    filters.cursor === undefined ? null : decodeCursor(filters.cursor);
  if (filters.cursor !== undefined && cursor === null) {
    issues.push(issue("cursor", "invalid_cursor", "That cursor is not valid"));
  }
  if (issues.length > 0) throw validationFailed(issues);

  const rows = await ctx.db.assignmentSubmission.findMany({
    where: {
      AND: [
        { organizationId: ctx.organizationId },
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
              classSeat: {
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
          : { submittedAt: { gte: filters.submittedFrom } },
        filters.submittedBefore === undefined
          ? {}
          : { submittedAt: { lt: filters.submittedBefore } },
        cursor === null
          ? {}
          : {
              OR: [
                { submittedAt: { lt: cursor.submittedAt } },
                { submittedAt: cursor.submittedAt, id: { lt: cursor.id } },
              ],
            },
      ],
    },
    include: submissionInclude,
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
  });

  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  return {
    items: page.map(toSubmissionView),
    nextCursor:
      rows.length > pageSize && last
        ? encodeCursor({ submittedAt: last.submittedAt, id: last.id })
        : null,
  };
}

export async function listOwnSubmissions(
  ctx: RequestContext,
  filters: SubmissionFilters,
): Promise<SubmissionPage> {
  requirePermission(ctx, { submission: ["read"] });
  requireRole(ctx, "student");

  return runSubmissionQuery(
    ctx,
    { classSeat: { memberId: ctx.memberId } },
    filters,
  );
}

export interface OverviewFilters extends Omit<
  SubmissionFilters,
  "submittedFrom" | "submittedBefore"
> {
  /** Calendar days (`YYYY-MM-DD`) in the school's time zone, both inclusive. */
  from?: string;
  to?: string;
}

export const MIN_STUDENT_FILTER_LENGTH = 2;

export function validateOverviewFilters(
  filters: OverviewFilters,
): ValidationIssue[] {
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

export async function listSubmissionsOverview(
  ctx: RequestContext,
  filters: OverviewFilters,
): Promise<SubmissionPage> {
  requirePermission(ctx, { submission: ["readAll"] });
  const { timezone } = await ctx.db.organizationPreferences.findUniqueOrThrow({
    where: { organizationId: ctx.organizationId },
  });
  const range = instantsForDayRange(filters, timezone);

  return runSubmissionQuery(
    ctx,
    ctx.role === "administrator"
      ? {}
      : {
          assignment: {
            class: {
              teachers: {
                some: { memberId: ctx.memberId, deletedAt: null },
              },
            },
          },
        },
    {
      grade: filters.grade,
      assignment: filters.assignment,
      student: filters.student,
      pageSize: filters.pageSize,
      cursor: filters.cursor,
      ...(range.from ? { submittedFrom: range.from } : {}),
      ...(range.before ? { submittedBefore: range.before } : {}),
    },
    validateOverviewFilters(filters),
  );
}

async function loadSubmissionView(
  ctx: RequestContext,
  submissionId: string,
): Promise<SubmissionView> {
  const { submission } = await loadAccessibleSubmission(ctx, submissionId);

  return toSubmissionView(
    await ctx.db.assignmentSubmission.findFirstOrThrow({
      where: { id: submission.id, organizationId: ctx.organizationId },
      include: submissionInclude,
    }),
  );
}

/** The caller's view of one submission, without logging a read; for responses that follow a write. */
export async function getSubmission(
  ctx: RequestContext,
  submissionId: string,
): Promise<SubmissionView> {
  requirePermission(ctx, { submission: ["read"] });
  return loadSubmissionView(ctx, submissionId);
}

/** A single-record read, so it is logged. */
export async function readSubmission(
  ctx: RequestContext,
  submissionId: string,
): Promise<SubmissionView> {
  const view = await getSubmission(ctx, submissionId);
  await recordActivity(ctx.db, ctx, {
    action: "read",
    resourceType: "submission",
    resourceId: submissionId,
  });
  return view;
}
