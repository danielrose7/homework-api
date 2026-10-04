import { ApiError } from "@/lib/server/errors";
import { STATUS } from "@/lib/http-status";

/** The grade version is the quoted ISO 8601 `graded_at`, which `Timestamptz(3)` round-trips exactly. */
export function gradeEtag(gradedAt: Date): string {
  return `"${gradedAt.toISOString()}"`;
}

/** The version inside a single quoted `If-Match` value, or undefined when the header is absent. */
export function parseIfMatch(header: string | null): string | undefined {
  if (header === null) return undefined;
  const match = /^"([^"]+)"$/.exec(header.trim());
  if (!match?.[1]) {
    throw new ApiError(
      STATUS.bad_request,
      "invalid_if_match",
      'Send If-Match with the quoted ETag you last received, such as "2026-10-04T10:00:00.123Z"',
    );
  }
  return match[1];
}
