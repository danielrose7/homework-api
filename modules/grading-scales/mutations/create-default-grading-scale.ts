import { STANDARD_AF } from "@/lib/domain/grading";
import type { DbClient } from "@/lib/server/db-types";
import { addBands } from "@/modules/grading-scales/mutations/add-bands";

export async function createDefaultGradingScale(
  db: DbClient,
  organization_id: string,
): Promise<string> {
  const existing = await db.gradingScale.findFirst({
    where: { organization_id, is_default: true },
    include: { bands: { select: { id: true } } },
  });
  if (existing) {
    if (existing.bands.length === 0) {
      await addBands(db, organization_id, existing.id, STANDARD_AF);
    }
    return existing.id;
  }

  const scale = await db.gradingScale.create({
    data: { organization_id, name: "Standard A–F", is_default: true },
  });
  await addBands(db, organization_id, scale.id, STANDARD_AF);
  return scale.id;
}
