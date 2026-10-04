import { requirePermission, type RequestContext } from "@/lib/server/context";
import { toBand } from "@/modules/grading-scales/serializers";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

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
