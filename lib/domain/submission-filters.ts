export const UNGRADED = "ungraded";

/** Grade filters match a band label or its group, ignoring case; `ungraded` is the reserved word for no grade. */
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
