import { percentOf } from "@/lib/domain/grading";
import { listJson } from "@/lib/server/list-json";
import type {
  SubmissionPage,
  SubmissionRow,
  SubmissionView,
} from "@/modules/submissions/types";

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

export function serializeSubmission(view: SubmissionView) {
  return {
    id: view.id,
    object: "submission" as const,
    assignment: view.assignment,
    student: {
      member_id: view.student.memberId,
      name: view.student.name,
      username: view.student.username,
    },
    attempt_number: view.attemptNumber,
    text: view.text,
    submitted_at: view.submittedAt.toISOString(),
    graded_at: view.gradedAt?.toISOString() ?? null,
    teacher_notes: view.teacherNotes,
    grade:
      view.grade === null
        ? null
        : {
            label: view.grade.label,
            group: view.grade.group,
            points_awarded: view.grade.pointsAwarded,
            max_points: view.grade.maxPoints,
            percent: view.grade.percent,
            scale_id: view.grade.scaleId,
          },
  };
}

export function serializeSubmissionPage(url: string, page: SubmissionPage) {
  return listJson(url, page.items.map(serializeSubmission), page.hasMore);
}
