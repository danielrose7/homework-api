import { describe, expect, it } from "vitest";

import { formatHundredths, toHundredths } from "../decimal";
import {
  PASS_FAIL,
  PLUS_MINUS,
  STANDARD_AF,
  findManualBand,
  isManualOnly,
  lookupBand,
  matchesGradeFilter,
  percentOf,
  resolveScaleId,
  validateScale,
  type Band,
  type BandInput,
} from "../grading";

function withIds(bands: readonly BandInput[]): Band[] {
  return bands.map((band, index) => ({
    ...band,
    id: `band-${index}`,
    sortOrder: index,
  }));
}

const standard = withIds(STANDARD_AF);
const plusMinus = withIds(PLUS_MINUS);
const passFail = withIds(PASS_FAIL);

const labelFor = (
  bands: Band[],
  points: string | number,
  max: string | number,
) => lookupBand(bands, points, max)?.label ?? null;

describe("decimals", () => {
  it("parses up to two decimals exactly and rejects the rest", () => {
    expect(toHundredths("42.5")).toBe(4250);
    expect(toHundredths(7)).toBe(700);
    expect(toHundredths("0.07")).toBe(7);
    expect(toHundredths("-1.25")).toBe(-125);
    expect(toHundredths("1.234")).toBeNull();
    expect(toHundredths("abc")).toBeNull();
    expect(toHundredths("")).toBeNull();
  });

  it("formats hundredths back to a decimal string", () => {
    expect(formatHundredths(4250)).toBe("42.50");
    expect(formatHundredths(7)).toBe("0.07");
    expect(formatHundredths(-125)).toBe("-1.25");
  });
});

describe("lookupBand on the standard A-F scale", () => {
  it.each([
    [100, "A"],
    [90, "A"],
    ["89.99", "B"],
    [80, "B"],
    ["79.99", "C"],
    [70, "C"],
    ["69.99", "D"],
    [60, "D"],
    ["59.99", "F"],
    [0, "F"],
  ])("%s out of 100 is %s", (points, expected) => {
    expect(labelFor(standard, points, 100)).toBe(expected);
  });

  it("works against any maximum, not just 100", () => {
    expect(labelFor(standard, 45, 50)).toBe("A");
    expect(labelFor(standard, "44.99", 50)).toBe("B");
    expect(labelFor(standard, 9, 10)).toBe("A");
    expect(labelFor(standard, "26.67", "33.33")).toBe("B");
  });

  it("never rounds a near miss up", () => {
    expect(labelFor(standard, "89.99", 100)).toBe("B");
    expect(labelFor(standard, "8.99", 10)).toBe("B");
  });

  it("resolves a score above the maximum into the top band", () => {
    expect(labelFor(standard, 105, 100)).toBe("A");
  });

  it("never produces a manual-only band from points", () => {
    for (let points = 0; points <= 100; points += 1) {
      expect(labelFor(standard, points, 100)).not.toBe("Incomplete");
    }
  });

  it("rejects unusable inputs", () => {
    expect(lookupBand(standard, 10, 0)).toBeNull();
    expect(lookupBand(standard, -1, 100)).toBeNull();
    expect(lookupBand(standard, "1.234", 100)).toBeNull();
  });

  it("is order independent", () => {
    expect(labelFor([...standard].reverse(), 85, 100)).toBe("B");
  });
});

describe("lookupBand on a plus/minus scale", () => {
  it.each([
    [100, "A+"],
    [97, "A+"],
    ["96.99", "A"],
    [93, "A"],
    ["92.99", "A-"],
    [90, "A-"],
    ["89.99", "B+"],
    [87, "B+"],
    [83, "B"],
    [80, "B-"],
    [77, "C+"],
    [73, "C"],
    [70, "C-"],
    [67, "D+"],
    [63, "D"],
    [60, "D-"],
    ["59.99", "F"],
  ])("%s out of 100 is %s", (points, expected) => {
    expect(labelFor(plusMinus, points, 100)).toBe(expected);
  });
});

describe("lookupBand on a pass/fail scale", () => {
  it("passes at 60% and fails below", () => {
    expect(labelFor(passFail, 60, 100)).toBe("Pass");
    expect(labelFor(passFail, "59.99", 100)).toBe("Fail");
    expect(labelFor(passFail, 0, 100)).toBe("Fail");
  });
});

describe("percentOf", () => {
  it("rounds half up to two decimals", () => {
    expect(percentOf(1, 3)).toBe("33.33");
    expect(percentOf(2, 3)).toBe("66.67");
    expect(percentOf(1, 8)).toBe("12.50");
    expect(percentOf(105, 100)).toBe("105.00");
    expect(percentOf(0, 20)).toBe("0.00");
  });

  it("returns null when it cannot be computed", () => {
    expect(percentOf(5, 0)).toBeNull();
    expect(percentOf("x", 10)).toBeNull();
  });
});

describe("manual bands", () => {
  it("finds a band by label ignoring case and marks Incomplete manual-only", () => {
    const band = findManualBand(standard, " incomplete ");
    expect(band?.label).toBe("Incomplete");
    expect(band && isManualOnly(band)).toBe(true);
    expect(findManualBand(standard, "Excused")).toBeNull();
  });
});

describe("validateScale", () => {
  const ok = (bands: readonly BandInput[]) =>
    validateScale(bands).map((i) => i.code);

  const base: BandInput = {
    label: "X",
    groupLabel: null,
    minPercent: "0",
    gpaPoints: null,
    isPassing: true,
    countsInAverage: true,
  };

  it("accepts the built-in scales", () => {
    expect(ok(STANDARD_AF)).toEqual([]);
    expect(ok(PLUS_MINUS)).toEqual([]);
    expect(ok(PASS_FAIL)).toEqual([]);
  });

  it("requires at least one band", () => {
    expect(ok([])).toEqual(["scale_empty"]);
  });

  it("requires a computed band at zero", () => {
    expect(ok([{ ...base, minPercent: "50" }])).toContain("missing_zero_band");
    expect(ok([{ ...base, minPercent: null, label: "Incomplete" }])).toContain(
      "missing_zero_band",
    );
  });

  it("rejects duplicate labels (any case) and thresholds", () => {
    const codes = ok([
      base,
      { ...base, label: "x", minPercent: "50" },
      { ...base, label: "Y", minPercent: "50" },
    ]);
    expect(codes).toContain("duplicate_label");
    expect(codes).toContain("duplicate_threshold");
  });

  it("rejects blank and reserved labels", () => {
    expect(ok([{ ...base, label: "  " }])).toContain("label_required");
    expect(ok([{ ...base, label: "Ungraded" }])).toContain("reserved_label");
  });

  it("rejects bad numbers", () => {
    expect(ok([{ ...base, minPercent: "-5" }])).toContain("negative_threshold");
    expect(ok([{ ...base, minPercent: "9.999" }])).toContain("invalid_percent");
    expect(ok([{ ...base, gpaPoints: "9" }])).toContain("gpa_out_of_range");
    expect(ok([{ ...base, groupLabel: " " }])).toContain("group_label_blank");
  });

  it("reports every problem at once with a field path", () => {
    const issues = validateScale([
      { ...base, label: "", minPercent: "-1" },
      { ...base, label: "B", minPercent: "5.555" },
    ]);
    expect(issues.length).toBeGreaterThan(2);
    expect(issues.map((i) => i.field)).toContain("bands[0].label");
    expect(issues.map((i) => i.field)).toContain("bands[1].minPercent");
  });
});

describe("resolveScaleId", () => {
  it("prefers assignment, then class, then the school default", () => {
    expect(
      resolveScaleId({ assignment: "a", class: "c", schoolDefault: "d" }),
    ).toBe("a");
    expect(
      resolveScaleId({ assignment: null, class: "c", schoolDefault: "d" }),
    ).toBe("c");
    expect(
      resolveScaleId({ assignment: null, class: null, schoolDefault: "d" }),
    ).toBe("d");
  });
});

describe("matchesGradeFilter", () => {
  const b = (label: string, groupLabel: string | null = null) => ({
    label,
    groupLabel,
  });

  it("matches a group as well as an exact label, ignoring case", () => {
    expect(matchesGradeFilter(b("B+", "B"), "b")).toBe(true);
    expect(matchesGradeFilter(b("B+", "B"), "B+")).toBe(true);
    expect(matchesGradeFilter(b("B-", "B"), "B+")).toBe(false);
    expect(matchesGradeFilter(b("C"), "C")).toBe(true);
  });

  it("treats Incomplete as an ordinary label and ungraded as no band", () => {
    expect(matchesGradeFilter(b("Incomplete"), "incomplete")).toBe(true);
    expect(matchesGradeFilter(null, "ungraded")).toBe(true);
    expect(matchesGradeFilter(b("A"), "ungraded")).toBe(false);
    expect(matchesGradeFilter(null, "A")).toBe(false);
  });
});
