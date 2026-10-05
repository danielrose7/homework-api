import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";

const roles = ["app_owner", "app_user", "app_readonly"] as const;

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function applyRoles(
  admin_url: string,
  passwords: Record<(typeof roles)[number], string>,
) {
  const sql = roles.reduce(
    (text, role) =>
      text.replace(`{{${role}_password}}`, quote(passwords[role])),
    readFileSync("scripts/roles.sql", "utf8"),
  );
  const client = new Client({ connectionString: admin_url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function main() {
  config({ path: ".env.local", quiet: true });
  config({ quiet: true });
  const admin_url = process.env.ADMIN_DATABASE_URL;
  if (!admin_url) throw new Error("ADMIN_DATABASE_URL is required");

  const url = new URL(admin_url);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  const passwords = Object.fromEntries(
    roles.map((role) => [role, local ? role : randomBytes(24).toString("hex")]),
  ) as Record<(typeof roles)[number], string>;

  await applyRoles(admin_url, passwords);
  if (local) return;

  const database = url.pathname.slice(1);
  const connection = (role: (typeof roles)[number]) => {
    const target = new URL(url);
    target.username = role;
    target.password = passwords[role];
    target.searchParams.delete("uselibpqcompat");
    return target.toString();
  };
  console.log(`Roles applied to ${url.hostname}/${database}.`);
  console.log("Passwords apply only to roles created by this run.");
  console.log(`DATABASE_URL=${connection("app_user")}`);
  console.log(`MIGRATION_DATABASE_URL=${connection("app_owner")}`);
}

if (process.argv[1]?.endsWith("roles.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
