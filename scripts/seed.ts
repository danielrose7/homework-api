import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { prisma } = await import("@/lib/server/db");
  const { auth } = await import("@/lib/server/auth");
  const { seedSandbox } =
    await import("@/app/sandbox/_server/mutations/seed-sandbox");
  const { printSummary } = await import("./summary");

  try {
    printSummary(await seedSandbox(prisma, auth));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
