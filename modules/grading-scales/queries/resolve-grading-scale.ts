import { resolveScaleId } from "@/lib/domain/grading";
import type { DbClient } from "@/lib/server/db-types";
import { conflict, notFound } from "@/lib/server/errors";
import { loadGradingScale } from "@/modules/grading-scales/queries/load-grading-scale";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

export async function resolveGradingScale(
  db: DbClient,
  params: {
    organization_id: string;
    assignmentScaleId: string | null;
    classScaleId: string | null;
  },
): Promise<ScaleWithBands> {
  const schoolDefault = await db.gradingScale.findFirst({
    where: { organization_id: params.organization_id, is_default: true },
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
  const scale = await loadGradingScale(db, params.organization_id, id);
  if (!scale) throw notFound();
  return scale;
}
