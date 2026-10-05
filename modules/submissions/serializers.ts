import { percentOf } from "@/lib/domain/grading";
import { listJson } from "@/lib/server/list-json";
import { serializeAttachmentList } from "@/modules/attachments/serializers";
import type { AttachmentSummary } from "@/modules/attachments/types";
import type {
  GradeResult,
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

export function toGradeResult(params: {
  submission_id: string;
  graded_at: Date;
  teacher_notes: string | null;
  scale_id: string;
  band_id: string;
  label: string;
  group: string;
  points_awarded: string | null;
  max_points: string | null;
}): GradeResult {
  const { points_awarded, max_points } = params;
  return {
    submission_id: params.submission_id,
    graded_at: params.graded_at.toISOString(),
    teacher_notes: params.teacher_notes,
    grade: {
      band_id: params.band_id,
      scale_id: params.scale_id,
      label: params.label,
      group: params.group,
      points_awarded,
      max_points,
      percent:
        points_awarded !== null && max_points !== null
          ? percentOf(points_awarded, max_points)
          : null,
    },
  };
}

export function serializeSubmission(view: SubmissionView) {
  return {
    ...view,
    object: "submission" as const,
    submitted_at: view.submitted_at.toISOString(),
    graded_at: view.graded_at?.toISOString() ?? null,
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
