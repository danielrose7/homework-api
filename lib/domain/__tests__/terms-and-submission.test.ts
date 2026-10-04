import { describe, expect, it } from "vitest";

import { submissionEligibility } from "../submission";
import {
  isCalendarDate,
  rangesOverlap,
  validateRange,
  validateTerm,
} from "../terms";

import { STATUS } from "@/lib/http-status";

describe("calendar dates", () => {
  it("accepts real dates only", () => {
    expect(isCalendarDate("2026-09-01")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("09/01/2026")).toBe(false);
  });
});

describe("validateRange", () => {
  it("requires the end to be after the start", () => {
    expect(
      validateRange({ starts_on: "2026-09-01", ends_on: "2026-09-01" })[0]
        ?.code,
    ).toBe("end_not_after_start");
    expect(
      validateRange({ starts_on: "2026-09-02", ends_on: "2026-09-01" })[0]
        ?.code,
    ).toBe("end_not_after_start");
    expect(
      validateRange({ starts_on: "2026-09-01", ends_on: "2026-12-20" }),
    ).toEqual([]);
  });

  it("flags bad dates before comparing", () => {
    const codes = validateRange({
      starts_on: "nope",
      ends_on: "2026-12-20",
    }).map((i) => i.code);
    expect(codes).toEqual(["invalid_date"]);
  });
});

describe("rangesOverlap", () => {
  const a = { starts_on: "2026-09-01", ends_on: "2026-12-20" };
  it("treats shared days as overlap and gaps as clear", () => {
    expect(
      rangesOverlap(a, { starts_on: "2026-12-20", ends_on: "2027-01-30" }),
    ).toBe(true);
    expect(
      rangesOverlap(a, { starts_on: "2026-12-21", ends_on: "2027-01-30" }),
    ).toBe(false);
    expect(
      rangesOverlap(a, { starts_on: "2026-10-01", ends_on: "2026-10-02" }),
    ).toBe(true);
  });
});

describe("validateTerm", () => {
  const year = { starts_on: "2026-09-01", ends_on: "2027-06-15" };
  const fall = {
    id: "t1",
    name: "Fall",
    starts_on: "2026-09-01",
    ends_on: "2026-12-20",
  };

  it("accepts a term inside the year that does not overlap", () => {
    expect(
      validateTerm({ starts_on: "2027-01-05", ends_on: "2027-06-15" }, year, [
        fall,
      ]),
    ).toEqual([]);
  });

  it("rejects a term outside the year", () => {
    const codes = validateTerm(
      { starts_on: "2026-08-01", ends_on: "2026-10-01" },
      year,
      [],
    ).map((i) => i.code);
    expect(codes).toContain("outside_academic_year");
  });

  it("rejects overlap with another term but not with itself", () => {
    const overlapping = { starts_on: "2026-12-01", ends_on: "2027-02-01" };
    expect(validateTerm(overlapping, year, [fall])[0]?.code).toBe(
      "overlaps_term",
    );
    expect(
      validateTerm({ ...fall, ends_on: "2026-12-19" }, year, [fall]),
    ).toEqual([]);
  });
});

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
