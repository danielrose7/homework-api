import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import { conflict, notFound, validationFailed } from "@/lib/server/errors";
import {
  STANDARD_AF,
  resolveScaleId,
  validateScale,
  type Band,
  type BandInput,
} from "@/lib/domain/grading";
import { issue, type ValidationIssue } from "@/lib/domain/validation";

export interface ScaleWithBands {
  id: string;
  name: string;
  isDefault: boolean;
  bands: Band[];
}

interface BandRow {
  id: string;
  label: string;
  groupLabel: string | null;
  minPercent: { toString(): string } | null;
  gpaPoints: { toString(): string } | null;
  isPassing: boolean | null;
  countsInAverage: boolean;
  sortOrder: number;
}

export function toBand(row: BandRow): Band {
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

function bandRows(bands: readonly BandInput[]) {
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

async function addBands(
  db: DbClient,
  organizationId: string,
  gradingScaleId: string,
  bands: readonly BandInput[],
) {
  await db.gradingScaleBand.createMany({
    data: bandRows(bands).map((band) => ({
      ...band,
      organizationId,
      gradingScaleId,
    })),
  });
}

/** Every new school gets this. Called from the Better Auth create-school hook and from test factories. */
export async function createDefaultGradingScale(
  db: DbClient,
  organizationId: string,
): Promise<string> {
  const existing = await db.gradingScale.findFirst({
    where: { organizationId, isDefault: true },
  });
  if (existing) return existing.id;

  const scale = await db.gradingScale.create({
    data: { organizationId, name: "Standard A–F", isDefault: true },
  });
  await addBands(db, organizationId, scale.id, STANDARD_AF);
  return scale.id;
}

export interface GradingScaleInput {
  name: string;
  isDefault?: boolean;
  bands: BandInput[];
}

export function validateGradingScaleInput(
  input: GradingScaleInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push(issue("name", "name_required", "Name is required"));
  }
  return [...issues, ...validateScale(input.bands)];
}

export async function createGradingScale(
  ctx: RequestContext,
  input: GradingScaleInput,
): Promise<ScaleWithBands> {
  requirePermission(ctx, { gradingScale: ["create"] });

  const issues = validateGradingScaleInput(input);
  if (issues.length > 0) throw validationFailed(issues);

  const name = input.name.trim();
  const taken = await ctx.db.gradingScale.findFirst({
    where: { organizationId: ctx.organizationId, name },
  });
  if (taken) {
    throw validationFailed([
      issue("name", "name_taken", `A scale named "${name}" already exists`),
    ]);
  }

  if (input.isDefault) {
    await ctx.db.gradingScale.updateMany({
      where: { organizationId: ctx.organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const scale = await ctx.db.gradingScale.create({
    data: {
      organizationId: ctx.organizationId,
      name,
      isDefault: input.isDefault ?? false,
    },
  });
  await addBands(ctx.db, ctx.organizationId, scale.id, input.bands);
  const bands = await ctx.db.gradingScaleBand.findMany({
    where: { organizationId: ctx.organizationId, gradingScaleId: scale.id },
    orderBy: { sortOrder: "asc" },
  });

  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "grading_scale",
    resourceId: scale.id,
  });

  return {
    id: scale.id,
    name: scale.name,
    isDefault: scale.isDefault,
    bands: bands.map(toBand),
  };
}

export async function setDefaultGradingScale(
  ctx: RequestContext,
  scaleId: string,
): Promise<void> {
  requirePermission(ctx, { gradingScale: ["update"] });

  const scale = await ctx.db.gradingScale.findFirst({
    where: { id: scaleId, organizationId: ctx.organizationId },
  });
  if (!scale) throw notFound();
  if (scale.isDefault) return;

  await ctx.db.gradingScale.updateMany({
    where: { organizationId: ctx.organizationId, isDefault: true },
    data: { isDefault: false },
  });
  await ctx.db.gradingScale.update({
    where: { id: scale.id },
    data: { isDefault: true },
  });

  await recordActivity(ctx.db, ctx, {
    action: "update",
    resourceType: "grading_scale",
    resourceId: scale.id,
    metadata: { changedFields: ["isDefault"] },
  });
}

export async function listGradingScales(
  ctx: RequestContext,
): Promise<ScaleWithBands[]> {
  requirePermission(ctx, { gradingScale: ["read"] });
  const scales = await ctx.db.gradingScale.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      bands: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
  return scales.map((scale) => ({
    id: scale.id,
    name: scale.name,
    isDefault: scale.isDefault,
    bands: scale.bands.map(toBand),
  }));
}

export async function getGradingScale(
  ctx: RequestContext,
  scaleId: string,
): Promise<ScaleWithBands> {
  requirePermission(ctx, { gradingScale: ["read"] });
  const scale = await loadScale(ctx.db, ctx.organizationId, scaleId);
  if (!scale) throw notFound();
  return scale;
}

async function loadScale(
  db: DbClient,
  organizationId: string,
  scaleId: string,
): Promise<ScaleWithBands | null> {
  const scale = await db.gradingScale.findFirst({
    where: { id: scaleId, organizationId },
    include: {
      bands: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!scale) return null;
  return {
    id: scale.id,
    name: scale.name,
    isDefault: scale.isDefault,
    bands: scale.bands.map(toBand),
  };
}

/** Assignment scale, else class scale, else the school default. */
export async function resolveGradingScale(
  db: DbClient,
  params: {
    organizationId: string;
    assignmentScaleId: string | null;
    classScaleId: string | null;
  },
): Promise<ScaleWithBands> {
  const schoolDefault = await db.gradingScale.findFirst({
    where: { organizationId: params.organizationId, isDefault: true },
  });
  if (!schoolDefault) {
    throw conflict(
      "no_default_scale",
      "This school has no default grading scale",
    );
  }

  const id = resolveScaleId({
    assignment: params.assignmentScaleId,
    class: params.classScaleId,
    schoolDefault: schoolDefault.id,
  });
  const scale = await loadScale(db, params.organizationId, id);
  if (!scale) throw notFound();
  return scale;
}
