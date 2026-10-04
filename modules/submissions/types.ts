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
    scaleId: string | null;
  } | null;
}

export interface SubmissionFilters {
  grade?: string;
  assignment?: string;
  student?: string;
  submittedFrom?: Date;
  submittedBefore?: Date;
  limit?: number;
  startingAfter?: string;
}

export interface SubmissionPage {
  items: SubmissionView[];
  hasMore: boolean;
}
