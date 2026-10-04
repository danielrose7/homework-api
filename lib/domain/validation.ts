import type { ErrorDetail } from "@/lib/server/errors";

export type ValidationIssue = ErrorDetail;

export const issue = (
  field: string,
  code: string,
  message: string,
): ValidationIssue => ({ field, code, message });
