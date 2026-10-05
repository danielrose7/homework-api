import { UNGRADED } from "@/lib/domain/submission-filters";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { SubmissionFilters } from "@/modules/submissions/types";

type Where = Prisma.AssignmentSubmissionWhereInput;

export interface SubmissionCursor {
  id: string;
  submitted_at: Date;
}

function gradeWhere(grade: string | undefined): Where {
  if (grade === undefined) return {};
  if (grade.toLowerCase() === UNGRADED) return { grade_label: null };
  return {
    OR: [
      { grade_label: { equals: grade, mode: "insensitive" } },
      { grade_group: { equals: grade, mode: "insensitive" } },
    ],
  };
}

function assignmentWhere(assignment: string | undefined): Where {
  if (assignment === undefined) return {};
  return {
    assignment: { title: { contains: assignment, mode: "insensitive" } },
  };
}

function studentWhere(student: string | undefined): Where {
  if (student === undefined) return {};
  return {
    class_seat: {
      member: {
        user: {
          OR: [
            { name: { contains: student, mode: "insensitive" } },
            { username: { contains: student, mode: "insensitive" } },
          ],
        },
      },
    },
  };
}

function submittedWhere(
  submitted_from: Date | undefined,
  submitted_before: Date | undefined,
): Where {
  if (submitted_from === undefined && submitted_before === undefined) {
    return {};
  }
  return {
    submitted_at: {
      ...(submitted_from === undefined ? {} : { gte: submitted_from }),
      ...(submitted_before === undefined ? {} : { lt: submitted_before }),
    },
  };
}

function afterWhere(after: SubmissionCursor | null): Where {
  if (after === null) return {};
  return {
    OR: [
      { submitted_at: { lt: after.submitted_at } },
      { submitted_at: after.submitted_at, id: { lt: after.id } },
    ],
  };
}

export function submissionWhere(
  organization_id: string,
  scope: Where,
  filters: SubmissionFilters,
  after: SubmissionCursor | null,
): Where {
  return {
    AND: [
      { organization_id },
      scope,
      gradeWhere(filters.grade),
      assignmentWhere(filters.assignment),
      studentWhere(filters.student),
      submittedWhere(filters.submitted_from, filters.submitted_before),
      afterWhere(after),
    ],
  };
}
