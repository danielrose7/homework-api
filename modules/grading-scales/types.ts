import type { Band, BandInput } from "@/lib/domain/grading";

export interface ScaleWithBands {
  id: string;
  name: string;
  is_default: boolean;
  bands: Band[];
}

export interface GradingScaleInput {
  name: string;
  is_default?: boolean;
  bands: BandInput[];
}

export interface BandRow {
  id: string;
  label: string;
  group_label: string | null;
  min_percent: { toString(): string } | null;
  gpa_points: { toString(): string } | null;
  is_passing: boolean | null;
  counts_in_average: boolean;
  sort_order: number;
}
