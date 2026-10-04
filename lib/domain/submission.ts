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
