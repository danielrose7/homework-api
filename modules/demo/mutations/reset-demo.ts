import { Pool } from "pg";

import type { Auth } from "@/lib/server/auth-factory";
import type { AppPrismaClient } from "@/lib/server/db";
import {
  seedSandbox,
  type SeedSummary,
} from "@/modules/demo/mutations/seed-sandbox";

/** Truncating needs the owner role: `app_user` has no TRUNCATE grant. */
export async function truncateAllTables(ownerUrl: string) {
  const pool = new Pool({ connectionString: ownerUrl, max: 1 });
  try {
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length === 0) return;
    const names = rows.map((row) => `"${row.tablename}"`).join(", ");
    await pool.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  } finally {
    await pool.end();
  }
}

export async function resetDemoData(params: {
  db: AppPrismaClient;
  auth: Auth;
  ownerUrl: string;
}): Promise<SeedSummary> {
  await truncateAllTables(params.ownerUrl);
  const summary = await seedSandbox(params.db, params.auth);
  await params.db.activityLog.create({
    data: {
      organizationId: summary.organizationId,
      actorType: "system",
      action: "reset",
      resourceType: "system",
      outcome: "success",
    },
  });
  return summary;
}
