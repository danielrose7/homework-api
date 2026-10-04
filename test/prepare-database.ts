import { execFileSync } from "node:child_process";

import { Client } from "pg";

import type { DatabaseEnv } from "./env";

export async function prepareDatabase(env: DatabaseEnv) {
  const admin = new Client({ connectionString: env.adminUrl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [env.database],
    );
    if (!rowCount) {
      await admin.query(`CREATE DATABASE ${env.database} OWNER app_owner`);
    }
  } finally {
    await admin.end();
  }

  const url = new URL(env.adminUrl);
  url.pathname = `/${env.database}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query(
      `GRANT CONNECT ON DATABASE ${env.database} TO app_user, app_readonly`,
    );
    await db.query("ALTER SCHEMA public OWNER TO app_owner");
    await db.query("GRANT USAGE ON SCHEMA public TO app_user, app_readonly");
    await db.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user",
    );
    await db.query(
      "ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly",
    );
  } finally {
    await db.end();
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, MIGRATION_DATABASE_URL: env.owner_url },
  });
}
