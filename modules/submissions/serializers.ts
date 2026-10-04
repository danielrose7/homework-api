import { percentOf } from "@/lib/domain/grading";
import { listJson } from "@/lib/server/list-json";
import { serializeAttachmentList } from "@/modules/attachments/serializers";
import type { AttachmentSummary } from "@/modules/attachments/types";
import type {
  SubmissionPage,
  SubmissionRow,
  SubmissionView,
} from "@/modules/submissions/types";

export function toSubmissionView(row: SubmissionRow): SubmissionView {
  const points_awarded = row.points_awarded?.toFixed(2) ?? null;
  const max_points = row.assignment.max_points?.toFixed(2) ?? null;
  const { member } = row.class_seat;

  return {
    id: row.id,
    assignment: { id: row.assignment.id, title: row.assignment.title },
    student: {
      member_id: member.id,
      name: member.user.name,
      username: member.user.username,
    },
    attempt_number: row.attempt_number,
    text: row.text_content,
    submitted_at: row.submitted_at,
    graded_at: row.graded_at,
    teacher_notes: row.teacher_notes,
    grade:
      row.grade_label === null
        ? null
        : {
            label: row.grade_label,
            group: row.grade_group,
            points_awarded,
            max_points: points_awarded === null ? null : max_points,
            percent:
              points_awarded !== null && max_points !== null
                ? percentOf(points_awarded, max_points)
                : null,
            scale_id: row.grading_scale_id,
          },
  };
}

export function serializeSubmission(view: SubmissionView) {
  return {
    id: view.id,
    object: "submission" as const,
    assignment: view.assignment,
    student: {
      member_id: view.student.member_id,
      name: view.student.name,
      username: view.student.username,
    },
    attempt_number: view.attempt_number,
    text: view.text,
    submitted_at: view.submitted_at.toISOString(),
    graded_at: view.graded_at?.toISOString() ?? null,
    teacher_notes: view.teacher_notes,
    grade:
      view.grade === null
        ? null
        : {
            label: view.grade.label,
            group: view.grade.group,
            points_awarded: view.grade.points_awarded,
            max_points: view.grade.max_points,
            percent: view.grade.percent,
            scale_id: view.grade.scale_id,
          },
  };
}

export function serializeSubmissionPage(url: string, page: SubmissionPage) {
  return listJson(url, page.items.map(serializeSubmission), page.has_more);
}

export function serializeSubmittedSubmission(
  submission: SubmissionView,
  attachments_url: string,
  attachments: AttachmentSummary[],
) {
  return {
    ...serializeSubmission(submission),
    attachments: serializeAttachmentList(attachments_url, attachments),
  };
}
