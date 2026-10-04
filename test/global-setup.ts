import { execFileSync } from "node:child_process";

import { Client } from "pg";

import { testEnv } from "./env";

async function ensureDatabase() {
  const admin = new Client({ connectionString: testEnv.adminUrl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [testEnv.database],
    );
    if (!rowCount) {
      await admin.query(`CREATE DATABASE ${testEnv.database} OWNER app_owner`);
    }
  } finally {
    await admin.end();
  }

  const url = new URL(testEnv.adminUrl);
  url.pathname = `/${testEnv.database}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query(
      "GRANT CONNECT ON DATABASE homework_test TO app_user, app_readonly",
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
}

export default async function setup() {
  await ensureDatabase();
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, MIGRATION_DATABASE_URL: testEnv.owner_url },
  });
}
