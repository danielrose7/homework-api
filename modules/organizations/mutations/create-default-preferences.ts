import type { DbClient } from "@/lib/server/db-types";

export async function createDefaultOrganizationPreferences(
  db: DbClient,
  organizationId: string,
): Promise<void> {
  await db.organizationPreferences.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}
