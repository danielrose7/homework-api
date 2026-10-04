import { STANDARD_AF } from "@/lib/domain/grading";
import type { DbClient } from "@/lib/server/db-types";
import { addBands } from "@/modules/grading-scales/mutations/add-bands";

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
