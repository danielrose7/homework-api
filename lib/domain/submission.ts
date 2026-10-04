import {
  MAX_FILES_PER_RECORD,
  validateUpload,
  type UploadInput,
} from "./uploads";
import { issue, type ValidationIssue } from "./validation";

export const MAX_TEXT_LENGTH = 50_000;

export type EligibilityResult =
  | { ok: true; attemptNumber: number }
  | { ok: false; status: 403 | 404 | 409; code: string };

export interface EligibilityInput {
  assignment: {
    publishedAt: Date | null;
    deletedAt: Date | null;
    maxSubmissions: number;
  };
  seat: { status: "active" | "dropped"; deletedAt: Date | null };
  attemptsSoFar: number;
}

/**
 * Whether a student may submit now. An unpublished or deleted assignment looks absent (404), a dropped seat is
 * forbidden (403), and hitting the attempt limit is a state conflict (409). Due dates are deliberately ignored:
 * late work is a future decision.
 */
export function submissionEligibility(
  input: EligibilityInput,
): EligibilityResult {
  const { assignment, seat, attemptsSoFar } = input;
  if (assignment.deletedAt !== null || assignment.publishedAt === null) {
    return { ok: false, status: 404, code: "not_found" };
  }
  if (seat.status !== "active" || seat.deletedAt !== null) {
    return { ok: false, status: 403, code: "seat_not_active" };
  }
  if (attemptsSoFar >= assignment.maxSubmissions) {
    return { ok: false, status: 409, code: "submission_limit_reached" };
  }
  return { ok: true, attemptNumber: attemptsSoFar + 1 };
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
