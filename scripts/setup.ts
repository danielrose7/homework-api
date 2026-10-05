import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";
import { applyRoles } from "./roles";

if (!existsSync(".env.local") && !existsSync(".env")) {
  copyFileSync(".env.example", ".env.local");
  console.log("Created .env.local from .env.example");
}

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const admin_url =
  process.env.ADMIN_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/homework";

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { stdio: "inherit" });

async function isEmpty() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ present: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM "user") AS present',
    );
    return !rows[0]?.present;
  } finally {
    await client.end();
  }
}

async function main() {
  run("docker", ["compose", "up", "-d", "--wait"]);
  await applyRoles(admin_url, {
    app_owner: "app_owner",
    app_user: "app_user",
    app_readonly: "app_readonly",
  });
  run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
  run("pnpm", ["exec", "prisma", "generate"]);
  if (process.env.SANDBOX_MODE === "true" && (await isEmpty())) {
    run("pnpm", ["exec", "tsx", "scripts/seed.ts"]);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
