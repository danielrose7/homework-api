import type { DbClient } from "@/lib/server/db-types";

export async function createDefaultOrganizationPreferences(
  db: DbClient,
  organization_id: string,
): Promise<void> {
  await db.organizationPreferences.upsert({
    where: { organization_id },
    create: { organization_id },
    update: {},
  });
}
