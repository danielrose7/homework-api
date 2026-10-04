import type { BandInput } from "@/lib/domain/grading";
import type { BandRow } from "@/modules/grading-scales/types";

export function toBand(row: BandRow) {
  return {
    id: row.id,
    label: row.label,
    groupLabel: row.groupLabel,
    minPercent: row.minPercent === null ? null : row.minPercent.toString(),
    gpaPoints: row.gpaPoints === null ? null : row.gpaPoints.toString(),
    isPassing: row.isPassing,
    countsInAverage: row.countsInAverage,
    sortOrder: row.sortOrder,
  };
}

export function toBandRows(bands: readonly BandInput[]) {
  return bands.map((band, index) => ({
    label: band.label.trim(),
    groupLabel: band.groupLabel?.trim() ?? null,
    minPercent: band.minPercent,
    gpaPoints: band.gpaPoints,
    isPassing: band.isPassing,
    countsInAverage: band.countsInAverage,
    sortOrder: index,
  }));
}
