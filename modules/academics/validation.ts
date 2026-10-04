import { toHundredths } from "@/lib/domain/decimal";
import { issue, type ValidationIssue } from "@/lib/domain/validation";
import type { DbClient } from "@/lib/server/db-types";
import { validationFailed } from "@/lib/server/errors";

const MAX_POINTS_LIMIT = 99_999_99;
const MAX_ATTEMPTS = 20;

export const day = (value: string) => new Date(`${value}T00:00:00Z`);
export const formatDay = (value: Date) => value.toISOString().slice(0, 10);

export function fail(issues: ValidationIssue[]) {
  if (issues.length > 0) throw validationFailed(issues);
}

export function requireName(value: string, field = "name", limit = 120) {
  const name = value.trim();
  if (!name) return [issue(field, "name_required", "A name is required")];
  if (name.length > limit) {
    return [issue(field, "too_long", `Use at most ${limit} characters`)];
  }
  return [];
}

export async function scaleIssue(
  db: DbClient,
  organization_id: string,
  grading_scale_id: string | null | undefined,
): Promise<ValidationIssue[]> {
  if (!grading_scale_id) return [];
  const scale = await db.gradingScale.findFirst({
    where: { id: grading_scale_id, organization_id },
  });
  return scale
    ? []
    : [issue("grading_scale_id", "not_found", "Grading scale not found")];
}

export type AssignmentKind = "homework" | "exam" | "quiz" | "project";

export interface AssignmentInput {
  title: string;
  description?: string | null;
  type: AssignmentKind;
  grading_mode?: "points" | "band";
  max_points?: string | null;
  grading_scale_id?: string | null;
  due_at?: Date | null;
  max_submissions?: number;
  publish?: boolean;
}

export function validateAssignmentInput(
  input: AssignmentInput,
): ValidationIssue[] {
  const issues = requireName(input.title, "title", 200);
  const mode = input.grading_mode ?? "points";
  const rawMax = input.max_points ?? null;
  const hasMax = rawMax !== null;

  if (mode === "points") {
    const max = rawMax === null ? null : toHundredths(rawMax);
    if (!hasMax) {
      issues.push(
        issue("max_points", "max_points_required", "Points are required"),
      );
    } else if (max === null) {
      issues.push(
        issue("max_points", "invalid_number", "Use at most two decimals"),
      );
    } else if (max <= 0) {
      issues.push(
        issue("max_points", "must_be_positive", "Must be greater than zero"),
      );
    } else if (max > MAX_POINTS_LIMIT) {
      issues.push(issue("max_points", "too_large", "Must be 99999.99 or less"));
    }
  } else if (hasMax) {
    issues.push(
      issue(
        "max_points",
        "max_points_not_allowed",
        "Pass/fail work has no points",
      ),
    );
  }

  const attempts = input.max_submissions ?? 1;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > MAX_ATTEMPTS) {
    issues.push(
      issue(
        "max_submissions",
        "invalid_max_submissions",
        `Use a whole number from 1 to ${MAX_ATTEMPTS}`,
      ),
    );
  }
  return issues;
}
