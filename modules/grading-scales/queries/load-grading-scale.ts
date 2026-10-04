import type { DbClient } from "@/lib/server/db-types";
import { toBand } from "@/modules/grading-scales/serializers";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

export async function loadGradingScale(
  db: DbClient,
  organization_id: string,
  scaleId: string,
): Promise<ScaleWithBands | null> {
  const scale = await db.gradingScale.findFirst({
    where: { id: scaleId, organization_id },
    include: {
      bands: { where: { deleted_at: null }, orderBy: { sort_order: "asc" } },
    },
  });
  if (!scale) return null;
  return {
    id: scale.id,
    name: scale.name,
    is_default: scale.is_default,
    bands: scale.bands.map(toBand),
  };
}
