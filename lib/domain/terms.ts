import { issue, type ValidationIssue } from "./validation";

/** Calendar days as `YYYY-MM-DD`, which compare correctly as strings. */
export interface DateRange {
  starts_on: string;
  ends_on: string;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.starts_on <= b.ends_on && b.starts_on <= a.ends_on;
}

export function validateRange(range: DateRange): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isCalendarDate(range.starts_on)) {
    issues.push(
      issue("starts_on", "invalid_date", "Use a real date as YYYY-MM-DD"),
    );
  }
  if (!isCalendarDate(range.ends_on)) {
    issues.push(
      issue("ends_on", "invalid_date", "Use a real date as YYYY-MM-DD"),
    );
  }
  if (issues.length === 0 && range.ends_on <= range.starts_on) {
    issues.push(
      issue("ends_on", "end_not_after_start", "End must be after the start"),
    );
  }
  return issues;
}

export interface TermSibling extends DateRange {
  id: string;
  name: string;
}

export function validateTerm(
  term: DateRange & { id?: string },
  year: DateRange,
  siblings: readonly TermSibling[],
): ValidationIssue[] {
  const issues = validateRange(term);
  if (issues.length > 0) return issues;

  if (term.starts_on < year.starts_on || term.ends_on > year.ends_on) {
    issues.push(
      issue(
        "starts_on",
        "outside_academic_year",
        "Term must fall inside its academic year",
      ),
    );
  }
  for (const sibling of siblings) {
    if (sibling.id !== term.id && rangesOverlap(term, sibling)) {
      issues.push(
        issue(
          "starts_on",
          "overlaps_term",
          `Overlaps the term "${sibling.name}"`,
        ),
      );
    }
  }
  return issues;
}
