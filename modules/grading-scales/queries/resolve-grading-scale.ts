import { resolveScaleId } from "@/lib/domain/grading";
import type { DbClient } from "@/lib/server/db-types";
import { conflict, notFound } from "@/lib/server/errors";
import { loadGradingScale } from "@/modules/grading-scales/queries/load-grading-scale";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

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
  const scale = await loadGradingScale(db, params.organizationId, id);
  if (!scale) throw notFound();
  return scale;
}
