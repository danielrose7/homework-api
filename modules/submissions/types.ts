import { Prisma } from "@/lib/generated/prisma/client";

export const submissionInclude = {
  assignment: { select: { id: true, title: true, maxPoints: true } },
  classSeat: {
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
