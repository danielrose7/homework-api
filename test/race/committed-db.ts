import { Pool } from "pg";
import { afterAll, afterEach, beforeAll } from "vitest";

import { createPrismaClient, type AppPrismaClient } from "@/lib/server/db";
import { setFactoryDb } from "@/test/factories/runtime";

import { raceEnv } from "../env";

let client: AppPrismaClient | undefined;
let owner: Pool | undefined;

export function raceDb(): AppPrismaClient {
  if (!client) throw new Error("raceDb() used outside a race test");
  return client;
}

/**
 * Race tests need real concurrent connections, which one wrapping transaction cannot model, so everything commits
 * and the tables are emptied between tests through the owner role.
 */
export function withCommittedDb() {
  beforeAll(() => {
    client = createPrismaClient(raceEnv.appUrl);
    owner = new Pool({ connectionString: raceEnv.owner_url });
    setFactoryDb(raceDb);
  });

  afterEach(async () => {
    if (!owner) throw new Error("owner pool not initialised");
    const { rows } = await owner.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
    await owner.query(`TRUNCATE ${tables} CASCADE`);
  });

  afterAll(async () => {
    await client?.$disconnect();
    await owner?.end();
    client = undefined;
    owner = undefined;
  });
}
