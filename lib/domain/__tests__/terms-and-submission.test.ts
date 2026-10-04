import { describe, expect, it } from "vitest";

import { submissionEligibility } from "../submission";
import {
  isCalendarDate,
  rangesOverlap,
  validateRange,
  validateTerm,
} from "../terms";

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
      validateRange({ startsOn: "2026-09-01", endsOn: "2026-09-01" })[0]?.code,
    ).toBe("end_not_after_start");
    expect(
      validateRange({ startsOn: "2026-09-02", endsOn: "2026-09-01" })[0]?.code,
    ).toBe("end_not_after_start");
    expect(
      validateRange({ startsOn: "2026-09-01", endsOn: "2026-12-20" }),
    ).toEqual([]);
  });

  it("flags bad dates before comparing", () => {
    const codes = validateRange({ startsOn: "nope", endsOn: "2026-12-20" }).map(
      (i) => i.code,
    );
    expect(codes).toEqual(["invalid_date"]);
  });
});

describe("rangesOverlap", () => {
  const a = { startsOn: "2026-09-01", endsOn: "2026-12-20" };
  it("treats shared days as overlap and gaps as clear", () => {
    expect(
      rangesOverlap(a, { startsOn: "2026-12-20", endsOn: "2027-01-30" }),
    ).toBe(true);
    expect(
      rangesOverlap(a, { startsOn: "2026-12-21", endsOn: "2027-01-30" }),
    ).toBe(false);
    expect(
      rangesOverlap(a, { startsOn: "2026-10-01", endsOn: "2026-10-02" }),
    ).toBe(true);
  });
});

describe("validateTerm", () => {
  const year = { startsOn: "2026-09-01", endsOn: "2027-06-15" };
  const fall = {
    id: "t1",
    name: "Fall",
    startsOn: "2026-09-01",
    endsOn: "2026-12-20",
  };

  it("accepts a term inside the year that does not overlap", () => {
    expect(
      validateTerm({ startsOn: "2027-01-05", endsOn: "2027-06-15" }, year, [
        fall,
      ]),
    ).toEqual([]);
  });

  it("rejects a term outside the year", () => {
    const codes = validateTerm(
      { startsOn: "2026-08-01", endsOn: "2026-10-01" },
      year,
      [],
    ).map((i) => i.code);
    expect(codes).toContain("outside_academic_year");
  });

  it("rejects overlap with another term but not with itself", () => {
    const overlapping = { startsOn: "2026-12-01", endsOn: "2027-02-01" };
    expect(validateTerm(overlapping, year, [fall])[0]?.code).toBe(
      "overlaps_term",
    );
    expect(
      validateTerm({ ...fall, endsOn: "2026-12-19" }, year, [fall]),
    ).toEqual([]);
  });
});

describe("submissionEligibility", () => {
  const published = new Date("2026-09-01T00:00:00Z");
  const assignment = {
    publishedAt: published,
    deletedAt: null,
    maxSubmissions: 1,
  };
  const seat = { status: "active" as const, deletedAt: null };

  it("allows the first attempt", () => {
    expect(
      submissionEligibility({ assignment, seat, attemptsSoFar: 0 }),
    ).toEqual({
      ok: true,
      attemptNumber: 1,
    });
  });

  it("blocks over-submission with a conflict by default", () => {
    expect(
      submissionEligibility({ assignment, seat, attemptsSoFar: 1 }),
    ).toEqual({
      ok: false,
      status: 409,
      code: "submission_limit_reached",
    });
  });

  it("numbers further attempts when the limit allows them", () => {
    expect(
      submissionEligibility({
        assignment: { ...assignment, maxSubmissions: 3 },
        seat,
        attemptsSoFar: 2,
      }),
    ).toEqual({ ok: true, attemptNumber: 3 });
  });

  it("hides unpublished and deleted assignments", () => {
    for (const hidden of [
      { ...assignment, publishedAt: null },
      { ...assignment, deletedAt: new Date() },
    ]) {
      expect(
        submissionEligibility({ assignment: hidden, seat, attemptsSoFar: 0 }),
      ).toMatchObject({
        ok: false,
        status: 404,
      });
    }
  });

  it("forbids dropped or deleted seats", () => {
    for (const bad of [
      { status: "dropped" as const, deletedAt: null },
      { status: "active" as const, deletedAt: new Date() },
    ]) {
      expect(
        submissionEligibility({ assignment, seat: bad, attemptsSoFar: 0 }),
      ).toMatchObject({
        ok: false,
        status: 403,
      });
    }
  });

  it("ignores the due date", () => {
    expect(
      submissionEligibility({
        assignment: { ...assignment, publishedAt: published },
        seat,
        attemptsSoFar: 0,
      }).ok,
    ).toBe(true);
  });
});
