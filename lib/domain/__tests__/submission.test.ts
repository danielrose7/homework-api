import { describe, expect, it } from "vitest";

import { submissionEligibility } from "../submission";
import { STATUS } from "@/lib/http-status";

describe("submissionEligibility", () => {
  const published = new Date("2026-09-01T00:00:00Z");
  const assignment = {
    published_at: published,
    deleted_at: null,
    max_submissions: 1,
  };
  const seat = { status: "active" as const, deleted_at: null };

  it("allows the first attempt", () => {
    expect(
      submissionEligibility({ assignment, seat, attempts_so_far: 0 }),
    ).toEqual({
      ok: true,
      attempt_number: 1,
    });
  });

  it("blocks over-submission with a conflict by default", () => {
    expect(
      submissionEligibility({ assignment, seat, attempts_so_far: 1 }),
    ).toEqual({
      ok: false,
      status: STATUS.conflict,
      code: "submission_limit_reached",
    });
  });

  it("numbers further attempts when the limit allows them", () => {
    expect(
      submissionEligibility({
        assignment: { ...assignment, max_submissions: 3 },
        seat,
        attempts_so_far: 2,
      }),
    ).toEqual({ ok: true, attempt_number: 3 });
  });

  it("hides unpublished and deleted assignments", () => {
    for (const hidden of [
      { ...assignment, published_at: null },
      { ...assignment, deleted_at: new Date() },
    ]) {
      expect(
        submissionEligibility({ assignment: hidden, seat, attempts_so_far: 0 }),
      ).toMatchObject({
        ok: false,
        status: STATUS.not_found,
      });
    }
  });

  it("forbids dropped or deleted seats", () => {
    for (const bad of [
      { status: "dropped" as const, deleted_at: null },
      { status: "active" as const, deleted_at: new Date() },
    ]) {
      expect(
        submissionEligibility({ assignment, seat: bad, attempts_so_far: 0 }),
      ).toMatchObject({
        ok: false,
        status: STATUS.forbidden,
      });
    }
  });

  it("ignores the due date", () => {
    expect(
      submissionEligibility({
        assignment: { ...assignment, published_at: published },
        seat,
        attempts_so_far: 0,
      }).ok,
    ).toBe(true);
  });
});
