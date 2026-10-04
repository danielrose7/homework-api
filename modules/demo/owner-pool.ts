import { Pool } from "pg";

const globalForPool = globalThis as unknown as { ownerPool?: Pool };

/** Demo tooling reads and truncates through the owner role. App and API code never imports this. */
export function ownerPool(): Pool {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");
  globalForPool.ownerPool ??= new Pool({ connectionString: url, max: 3 });
  return globalForPool.ownerPool;
}
