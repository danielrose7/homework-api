import { formatHundredths, toHundredths } from "./decimal";
import { issue, type ValidationIssue } from "./validation";

export const RESERVED_LABELS = ["ungraded"] as const;

export interface Band {
  id: string;
  label: string;
  groupLabel: string | null;
  /** Inclusive lower bound as a decimal string; null means the band is only ever chosen by a teacher. */
  minPercent: string | null;
  gpaPoints: string | null;
  isPassing: boolean | null;
  countsInAverage: boolean;
  sortOrder: number;
}

export type BandInput = Omit<Band, "id" | "sortOrder">;

function computedBands(bands: readonly Band[]): Array<Band & { min: number }> {
  const result: Array<Band & { min: number }> = [];
  for (const band of bands) {
    if (band.minPercent === null) continue;
    const min = toHundredths(band.minPercent);
    if (min !== null) result.push({ ...band, min });
  }
  return result;
}

/**
 * Finds the highest computed band whose threshold the score meets. Compares as exact integers
 * (points/max >= min%) so 89.99 out of 100 can never round up into an A.
 */
export function lookupBand(
  bands: readonly Band[],
  points: string | number,
  maxPoints: string | number,
): Band | null {
  const p = toHundredths(points);
  const m = toHundredths(maxPoints);
  if (p === null || m === null || m <= 0 || p < 0) return null;

  let best: (Band & { min: number }) | null = null;
  for (const band of computedBands(bands)) {
    if (p * 10_000 >= band.min * m && (best === null || band.min > best.min)) {
      best = band;
    }
  }
  return best;
}

/** Percentage to two decimals, rounded half up, as a string such as "87.50". */
export function percentOf(
  points: string | number,
  maxPoints: string | number,
): string | null {
  const p = toHundredths(points);
  const m = toHundredths(maxPoints);
  if (p === null || m === null || m <= 0) return null;
  return formatHundredths(Math.floor((p * 10_000 * 2 + m) / (m * 2)));
}

export function findManualBand(
  bands: readonly Band[],
  label: string,
): Band | null {
  const wanted = label.trim().toLowerCase();
  return bands.find((band) => band.label.toLowerCase() === wanted) ?? null;
}

export function isManualOnly(band: Band): boolean {
  return band.minPercent === null;
}

export function validateScale(bands: readonly BandInput[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (bands.length === 0) {
    return [issue("bands", "scale_empty", "A scale needs at least one band")];
  }

  const labels = new Set<string>();
  const thresholds = new Set<number>();
  let hasZero = false;

  bands.forEach((band, index) => {
    const at = (name: string) => `bands[${index}].${name}`;
    const label = band.label.trim();

    if (!label) {
      issues.push(issue(at("label"), "label_required", "Label is required"));
    } else {
      const key = label.toLowerCase();
      if ((RESERVED_LABELS as readonly string[]).includes(key)) {
        issues.push(
          issue(at("label"), "reserved_label", `"${label}" is a reserved word`),
        );
      }
      if (labels.has(key)) {
        issues.push(
          issue(at("label"), "duplicate_label", `"${label}" is used twice`),
        );
      }
      labels.add(key);
    }

    if (band.groupLabel !== null && !band.groupLabel.trim()) {
      issues.push(
        issue(at("groupLabel"), "group_label_blank", "Group label is blank"),
      );
    }

    if (band.minPercent !== null) {
      const min = toHundredths(band.minPercent);
      if (min === null) {
        issues.push(
          issue(
            at("minPercent"),
            "invalid_percent",
            "Use a number with at most two decimals",
          ),
        );
      } else if (min < 0) {
        issues.push(
          issue(at("minPercent"), "negative_threshold", "Must not be negative"),
        );
      } else {
        if (thresholds.has(min)) {
          issues.push(
            issue(
              at("minPercent"),
              "duplicate_threshold",
              `${formatHundredths(min)}% is used twice`,
            ),
          );
        }
        thresholds.add(min);
        if (min === 0) hasZero = true;
      }
    }

    if (band.gpaPoints !== null) {
      const gpa = toHundredths(band.gpaPoints);
      if (gpa === null || gpa < 0 || gpa > 500) {
        issues.push(
          issue(at("gpaPoints"), "gpa_out_of_range", "GPA must be 0 to 5"),
        );
      }
    }
  });

  if (!hasZero) {
    issues.push(
      issue(
        "bands",
        "missing_zero_band",
        "A computed band at 0% is required so every score resolves",
      ),
    );
  }

  return issues;
}

export function resolveScaleId(ids: {
  assignment: string | null;
  class: string | null;
  schoolDefault: string;
}): string {
  return ids.assignment ?? ids.class ?? ids.schoolDefault;
}

/** `B` matches B+, B and B-; `B+` matches only B+. */
export function matchesGradeFilter(
  band: Pick<Band, "label" | "groupLabel"> | null,
  filter: string,
): boolean {
  const wanted = filter.trim().toLowerCase();
  if (wanted === "ungraded") return band === null;
  if (band === null) return false;
  return (
    band.label.toLowerCase() === wanted ||
    (band.groupLabel ?? band.label).toLowerCase() === wanted
  );
}

const INCOMPLETE: BandInput = {
  label: "Incomplete",
  groupLabel: null,
  minPercent: null,
  gpaPoints: null,
  isPassing: null,
  countsInAverage: false,
};

const letter = (
  label: string,
  min: string,
  gpa: string,
  group: string | null = null,
): BandInput => ({
  label,
  groupLabel: group,
  minPercent: min,
  gpaPoints: gpa,
  isPassing: label !== "F",
  countsInAverage: true,
});

export const STANDARD_AF: readonly BandInput[] = [
  letter("A", "90", "4.00"),
  letter("B", "80", "3.00"),
  letter("C", "70", "2.00"),
  letter("D", "60", "1.00"),
  letter("F", "0", "0.00"),
  INCOMPLETE,
];

export const PLUS_MINUS: readonly BandInput[] = [
  letter("A+", "97", "4.00", "A"),
  letter("A", "93", "4.00", "A"),
  letter("A-", "90", "3.70", "A"),
  letter("B+", "87", "3.30", "B"),
  letter("B", "83", "3.00", "B"),
  letter("B-", "80", "2.70", "B"),
  letter("C+", "77", "2.30", "C"),
  letter("C", "73", "2.00", "C"),
  letter("C-", "70", "1.70", "C"),
  letter("D+", "67", "1.30", "D"),
  letter("D", "63", "1.00", "D"),
  letter("D-", "60", "0.70", "D"),
  letter("F", "0", "0.00", "F"),
  INCOMPLETE,
];

export const PASS_FAIL: readonly BandInput[] = [
  { ...letter("Pass", "60", "0"), gpaPoints: null },
  { ...letter("Fail", "0", "0"), gpaPoints: null, isPassing: false },
  INCOMPLETE,
];
