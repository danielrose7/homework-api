import { requirePermission, type RequestContext } from "@/lib/server/context";
import { toBand } from "@/modules/grading-scales/serializers";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

export async function listGradingScales(
  ctx: RequestContext,
): Promise<ScaleWithBands[]> {
  requirePermission(ctx, { grading_scale: ["read"] });
  const scales = await ctx.db.gradingScale.findMany({
    where: { organization_id: ctx.organization_id },
    orderBy: [{ is_default: "desc" }, { name: "asc" }],
    include: {
      bands: { where: { deleted_at: null }, orderBy: { sort_order: "asc" } },
    },
  });
  return scales.map((scale) => ({
    id: scale.id,
    name: scale.name,
    is_default: scale.is_default,
    bands: scale.bands.map(toBand),
  }));
}
