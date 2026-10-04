import { STATUS } from "@/lib/http-status";

import {
  MAX_FILES_PER_RECORD,
  validateUpload,
  type UploadInput,
} from "./uploads";
import { issue, type ValidationIssue } from "./validation";

export const MAX_TEXT_LENGTH = 50_000;

export type EligibilityResult =
  | { ok: true; attempt_number: number }
  | {
      ok: false;
      status:
        | typeof STATUS.forbidden
        | typeof STATUS.not_found
        | typeof STATUS.conflict;
      code: string;
    };

export interface EligibilityInput {
  assignment: {
    published_at: Date | null;
    deleted_at: Date | null;
    max_submissions: number;
  };
  seat: { status: "active" | "dropped"; deleted_at: Date | null };
  live_attempts: number;
  /** Highest attempt number ever used, soft-deleted rows included: the attempt number is unique regardless of deletion. */
  highest_attempt_number: number;
}

/**
 * Whether a student may submit now. An unpublished or deleted assignment looks absent (404), a dropped seat is
 * forbidden (403), and hitting the attempt limit is a state conflict (409). Due dates are deliberately ignored:
 * late work is a future decision.
 */
export function submissionEligibility(
  input: EligibilityInput,
): EligibilityResult {
  const { assignment, seat, live_attempts, highest_attempt_number } = input;
  if (assignment.deleted_at !== null || assignment.published_at === null) {
    return { ok: false, status: STATUS.not_found, code: "not_found" };
  }
  if (seat.status !== "active" || seat.deleted_at !== null) {
    return { ok: false, status: STATUS.forbidden, code: "seat_not_active" };
  }
  if (live_attempts >= assignment.max_submissions) {
    return {
      ok: false,
      status: STATUS.conflict,
      code: "submission_limit_reached",
    };
  }
  return { ok: true, attempt_number: highest_attempt_number + 1 };
}

export interface SubmissionContent {
  text: string | null;
  files: readonly UploadInput[];
}

/** Collects every problem with what a student is handing in, with file problems named by position. */
export function validateSubmissionContent(
  content: SubmissionContent,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (content.text === null && content.files.length === 0) {
    issues.push(
      issue("text", "content_required", "Send some text, a file, or both"),
    );
  }
  if (content.text !== null && content.text.length > MAX_TEXT_LENGTH) {
    issues.push(
      issue(
        "text",
        "text_too_long",
        `Text can be at most ${MAX_TEXT_LENGTH} characters`,
      ),
    );
  }
  if (content.files.length > MAX_FILES_PER_RECORD) {
    issues.push(
      issue(
        "files",
        "too_many_files",
        `At most ${MAX_FILES_PER_RECORD} files per submission`,
      ),
    );
  }
  content.files.forEach((file, index) => {
    for (const problem of validateUpload(file)) {
      issues.push({ ...problem, field: `files.${index}.${problem.field}` });
    }
  });
  return issues;
}
