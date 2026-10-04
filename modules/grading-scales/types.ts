import type { Band, BandInput } from "@/lib/domain/grading";

export interface ScaleWithBands {
  id: string;
  name: string;
  isDefault: boolean;
  bands: Band[];
}

export interface GradingScaleInput {
  name: string;
  isDefault?: boolean;
  bands: BandInput[];
}

export interface BandRow {
  id: string;
  label: string;
  groupLabel: string | null;
  minPercent: { toString(): string } | null;
  gpaPoints: { toString(): string } | null;
  isPassing: boolean | null;
  countsInAverage: boolean;
  sortOrder: number;
}
