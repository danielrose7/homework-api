export const UNGRADED = "ungraded";

/** The grade names a filter may use, lowercased: band labels and groups, plus the reserved word `ungraded`. */
export function knownGradeNames(
  bands: ReadonlyArray<{ label: string; groupLabel: string | null }>,
): Set<string> {
  const names = new Set<string>([UNGRADED]);
  for (const band of bands) {
    names.add(band.label.toLowerCase());
    if (band.groupLabel) names.add(band.groupLabel.toLowerCase());
  }
  return names;
}
