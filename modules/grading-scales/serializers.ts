import type { BandInput } from "@/lib/domain/grading";
import type { BandRow } from "@/modules/grading-scales/types";

export function toBand(row: BandRow) {
  return {
    id: row.id,
    label: row.label,
    group_label: row.group_label,
    min_percent: row.min_percent === null ? null : row.min_percent.toString(),
    gpa_points: row.gpa_points === null ? null : row.gpa_points.toString(),
    is_passing: row.is_passing,
    counts_in_average: row.counts_in_average,
    sort_order: row.sort_order,
  };
}

export function toBandRows(bands: readonly BandInput[]) {
  return bands.map((band, index) => ({
    label: band.label.trim(),
    group_label: band.group_label?.trim() ?? null,
    min_percent: band.min_percent,
    gpa_points: band.gpa_points,
    is_passing: band.is_passing,
    counts_in_average: band.counts_in_average,
    sort_order: index,
  }));
}
