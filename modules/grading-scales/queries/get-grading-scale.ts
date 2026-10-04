import { requirePermission, type RequestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/errors";
import { loadGradingScale } from "@/modules/grading-scales/queries/load-grading-scale";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

export async function getGradingScale(
  ctx: RequestContext,
  scaleId: string,
): Promise<ScaleWithBands> {
  requirePermission(ctx, { gradingScale: ["read"] });
  const scale = await loadGradingScale(ctx.db, ctx.organizationId, scaleId);
  if (!scale) throw notFound();
  return scale;
}
