import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { prisma } = await import("@/lib/server/db");
  const { auth } = await import("@/lib/server/auth");
  const { resetSandboxData } =
    await import("@/app/sandbox/_server/mutations/reset-sandbox");
  const { printSummary } = await import("./summary");

  const owner_url = process.env.MIGRATION_DATABASE_URL;
  if (!owner_url) throw new Error("MIGRATION_DATABASE_URL is not set");
  try {
    printSummary(await resetSandboxData({ db: prisma, auth, owner_url }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
