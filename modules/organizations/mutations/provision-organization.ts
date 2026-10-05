import type { DbClient } from "@/lib/server/db-types";
import { transact } from "@/lib/server/transaction";
import { createDefaultGradingScale } from "@/modules/grading-scales/mutations/create-default-grading-scale";
import { createDefaultOrganizationPreferences } from "@/modules/organizations/mutations/create-default-preferences";

export async function provisionOrganization(
  db: DbClient,
  organization_id: string,
): Promise<void> {
  await transact(db, async (tx) => {
    await createDefaultGradingScale(tx, organization_id);
    await createDefaultOrganizationPreferences(tx, organization_id);
  });
}
