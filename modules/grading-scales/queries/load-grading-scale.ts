import type { DbClient } from "@/lib/server/db-types";
import { toBand } from "@/modules/grading-scales/serializers";
import type { ScaleWithBands } from "@/modules/grading-scales/types";

export async function loadGradingScale(
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
