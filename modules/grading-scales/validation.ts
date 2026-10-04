import { validateScale } from "@/lib/domain/grading";
import { issue, type ValidationIssue } from "@/lib/domain/validation";
import type { GradingScaleInput } from "@/modules/grading-scales/types";

export function validateGradingScaleInput(
  input: GradingScaleInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push(issue("name", "name_required", "Name is required"));
  }
  return [...issues, ...validateScale(input.bands)];
}
