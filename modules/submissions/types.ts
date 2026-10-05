import { Prisma } from "@/lib/generated/prisma/client";

export const submissionInclude = {
  assignment: { select: { id: true, title: true, max_points: true } },
  class_seat: {
    select: {
      member: {
        select: { id: true, user: { select: { name: true, username: true } } },
      },
    },
  },
} satisfies Prisma.AssignmentSubmissionInclude;

export type SubmissionRow = Prisma.AssignmentSubmissionGetPayload<{
  include: typeof submissionInclude;
}>;

export interface SubmissionView {
  id: string;
  assignment: { id: string; title: string };
  student: { member_id: string; name: string; username: string | null };
  attempt_number: number;
  text: string | null;
  submitted_at: Date;
  graded_at: Date | null;
  teacher_notes: string | null;
  grade: {
    label: string;
    group: string | null;
    points_awarded: string | null;
    max_points: string | null;
    percent: string | null;
    scale_id: string | null;
  } | null;
}

export interface SubmissionFilters {
  grade?: string;
  assignment?: string;
  student?: string;
  submitted_from?: Date;
  submitted_before?: Date;
  limit?: number;
  starting_after?: string;
}

export interface SubmissionPage {
  items: SubmissionView[];
  has_more: boolean;
}

export interface GradeResult {
  submission_id: string;
  graded_at: string;
  teacher_notes: string | null;
  grade: {
    band_id: string;
    scale_id: string;
    label: string;
    group: string;
    points_awarded: string | null;
    max_points: string | null;
    percent: string | null;
  };
}
