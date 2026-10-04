import { describe, expect, it } from "vitest";

import { validateGradeRequest, type GradeContext } from "../grade-request";
import { PASS_FAIL, STANDARD_AF, type Band, type BandInput } from "../grading";

const withIds = (bands: readonly BandInput[]): Band[] =>
  bands.map((band, index) => ({ ...band, id: `b${index}`, sortOrder: index }));

const standard = withIds(STANDARD_AF);
const passFail = withIds(PASS_FAIL);

const pointsContext = (
  overrides: Partial<GradeContext> = {},
): GradeContext => ({
  assignment: { gradingMode: "points", maxPoints: "50" },
  bands: standard,
  currentBand: null,
  ...overrides,
});

const bandContext = (overrides: Partial<GradeContext> = {}): GradeContext => ({
  assignment: { gradingMode: "band", maxPoints: null },
  bands: passFail,
  currentBand: null,
  ...overrides,
});

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe("points-mode assignments", () => {
  it("accept points between zero and the maximum, inclusive", () => {
    for (const points of ["0", "25.5", "50"]) {
      expect(validateGradeRequest({ points }, pointsContext())).toEqual([]);
    }
  });

  it("reject points above the maximum (extra credit is blocked)", () => {
    expect(
      codes(validateGradeRequest({ points: "50.01" }, pointsContext())),
    ).toEqual(["exceeds_max_points"]);
  });

  it("reject negative, malformed and over-precise points", () => {
    expect(
      codes(validateGradeRequest({ points: "-1" }, pointsContext())),
    ).toEqual(["must_not_be_negative"]);
    expect(
      codes(validateGradeRequest({ points: "abc" }, pointsContext())),
    ).toEqual(["invalid_number"]);
    expect(
      codes(validateGradeRequest({ points: "10.123" }, pointsContext())),
    ).toEqual(["invalid_number"]);
  });

  it("require points or a band, never both", () => {
    expect(codes(validateGradeRequest({}, pointsContext()))).toEqual([
      "grade_required",
    ]);
    expect(
      codes(
        validateGradeRequest(
          { points: "10", band: "Incomplete" },
          pointsContext(),
        ),
      ),
    ).toEqual(["ambiguous_grade"]);
  });

  it("let a teacher pick only a manual-only band such as Incomplete", () => {
    expect(
      validateGradeRequest({ band: "incomplete" }, pointsContext()),
    ).toEqual([]);
    expect(codes(validateGradeRequest({ band: "A" }, pointsContext()))).toEqual(
      ["band_not_manual"],
    );
    expect(
      codes(validateGradeRequest({ band: "Excused" }, pointsContext())),
    ).toEqual(["unknown_band"]);
  });
});

describe("band-mode (pass/fail) assignments", () => {
  it("accept any band on the scale by name", () => {
    for (const band of ["Pass", "fail", "Incomplete"]) {
      expect(validateGradeRequest({ band }, bandContext())).toEqual([]);
    }
  });

  it("forbid points and require a band", () => {
    expect(
      codes(validateGradeRequest({ points: "10" }, bandContext())),
    ).toEqual(["points_not_allowed", "band_required"]);
    expect(codes(validateGradeRequest({}, bandContext()))).toEqual([
      "band_required",
    ]);
  });

  it("reject a band that is not on the scale", () => {
    expect(codes(validateGradeRequest({ band: "A" }, bandContext()))).toEqual([
      "unknown_band",
    ]);
  });
});

describe("regrades", () => {
  const graded = (label: string) =>
    standard.find((b) => b.label === label) ?? null;

  it("need a reason once a real grade exists", () => {
    const context = pointsContext({ currentBand: graded("B") });
    expect(codes(validateGradeRequest({ points: "10" }, context))).toEqual([
      "reason_required",
    ]);
    expect(
      validateGradeRequest({ points: "10", reason: "Rubric fix" }, context),
    ).toEqual([]);
    expect(
      codes(validateGradeRequest({ points: "10", reason: "   " }, context)),
    ).toEqual(["reason_required"]);
  });

  it("do not need a reason when replacing an Incomplete", () => {
    const context = pointsContext({ currentBand: graded("Incomplete") });
    expect(validateGradeRequest({ points: "40" }, context)).toEqual([]);
  });

  it("do not need a reason for a first grade", () => {
    expect(validateGradeRequest({ points: "40" }, pointsContext())).toEqual([]);
  });
});

describe("text limits", () => {
  it("cap teacher notes and reasons", () => {
    const issues = validateGradeRequest(
      {
        points: "10",
        teacherNotes: "x".repeat(5001),
        reason: "y".repeat(1001),
      },
      pointsContext({ currentBand: standard[0] ?? null }),
    );
    expect(codes(issues)).toEqual(["too_long", "too_long"]);
  });

  it("report everything at once", () => {
    const issues = validateGradeRequest(
      { points: "999", teacherNotes: "x".repeat(5001) },
      pointsContext({ currentBand: standard[1] ?? null }),
    );
    expect(codes(issues).sort()).toEqual(
      ["exceeds_max_points", "reason_required", "too_long"].sort(),
    );
  });
});
