import { requirePermission, type RequestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/errors";
import { loadGradingScale } from "@/modules/grading-scales/queries/load-grading-scale";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

export async function getGradingScale(
  ctx: RequestContext,
  scale_id: string,
): Promise<ScaleWithBands> {
  requirePermission(ctx, { grading_scale: ["read"] });
  const scale = await loadGradingScale(ctx.db, ctx.organization_id, scale_id);
  if (!scale) throw notFound();
  return scale;
}
