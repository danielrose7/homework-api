import { toHundredths } from "./decimal";
import { findManualBand, isManualOnly, type Band } from "./grading";
import { issue, type ValidationIssue } from "./validation";

export interface GradeRequest {
  points?: string | null;
  band?: string | null;
  teacherNotes?: string | null;
  reason?: string | null;
}

export interface GradeContext {
  assignment: { gradingMode: "points" | "band"; maxPoints: string | null };
  bands: readonly Band[];
  /** The band currently on the submission, or null if it has not been graded. */
  currentBand: Band | null;
}

export const NOTES_LIMIT = 5000;
export const REASON_LIMIT = 1000;

export function validateGradeRequest(
  request: GradeRequest,
  context: GradeContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasPoints = request.points !== undefined && request.points !== null;
  const hasBand = request.band !== undefined && request.band !== null;

  if (context.assignment.gradingMode === "points") {
    if (hasPoints && hasBand) {
      issues.push(
        issue(
          "band",
          "ambiguous_grade",
          "Send either points or a band, not both",
        ),
      );
    } else if (!hasPoints && !hasBand) {
      issues.push(
        issue("points", "grade_required", "Points or a band is required"),
      );
    } else if (request.points != null) {
      issues.push(
        ...pointsIssues(request.points, context.assignment.maxPoints),
      );
    } else if (request.band != null) {
      const band = findManualBand(context.bands, request.band);
      if (!band) {
        issues.push(
          issue(
            "band",
            "unknown_band",
            `No band named "${request.band}" on this scale`,
          ),
        );
      } else if (!isManualOnly(band)) {
        issues.push(
          issue(
            "band",
            "band_not_manual",
            `"${band.label}" comes from points; enter points instead`,
          ),
        );
      }
    }
  } else {
    if (hasPoints) {
      issues.push(
        issue(
          "points",
          "points_not_allowed",
          "This work is marked, not scored",
        ),
      );
    }
    if (!hasBand) {
      issues.push(issue("band", "band_required", "Choose a result"));
    } else if (
      request.band != null &&
      !findManualBand(context.bands, request.band)
    ) {
      issues.push(
        issue(
          "band",
          "unknown_band",
          `No band named "${request.band}" on this scale`,
        ),
      );
    }
  }

  if (
    request.teacherNotes != null &&
    request.teacherNotes.length > NOTES_LIMIT
  ) {
    issues.push(
      issue(
        "teacherNotes",
        "too_long",
        `Use at most ${NOTES_LIMIT} characters`,
      ),
    );
  }

  const reason = request.reason?.trim() ?? "";
  if (reason.length > REASON_LIMIT) {
    issues.push(
      issue("reason", "too_long", `Use at most ${REASON_LIMIT} characters`),
    );
  }
  const replacingRealGrade =
    context.currentBand !== null && !isManualOnly(context.currentBand);
  if (replacingRealGrade && !reason) {
    issues.push(
      issue("reason", "reason_required", "Say why the grade is changing"),
    );
  }
  return issues;
}

function pointsIssues(
  points: string,
  maxPoints: string | null,
): ValidationIssue[] {
  const value = toHundredths(points);
  if (value === null) {
    return [
      issue(
        "points",
        "invalid_number",
        "Use a number with at most two decimals",
      ),
    ];
  }
  if (value < 0) {
    return [
      issue("points", "must_not_be_negative", "Points cannot be negative"),
    ];
  }
  const max = maxPoints === null ? null : toHundredths(maxPoints);
  if (max !== null && value > max) {
    return [
      issue(
        "points",
        "exceeds_max_points",
        `Points cannot exceed ${maxPoints}`,
      ),
    ];
  }
  return [];
}
