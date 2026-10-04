import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { appendOnly, hideSoftDeleted } from "@/lib/server/db-extensions";

export function createPrismaClient(connectionString: string) {
  const base = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  return base.$extends(hideSoftDeleted).$extends(appendOnly);
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: AppPrismaClient };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * App-wide client. Tests must not import it: it is not wrapped in the per-test transaction, so its writes
 * persist. Use `testDb()` from test/rollback-db instead.
 */
export const prisma: AppPrismaClient =
  globalForPrisma.prisma ?? createPrismaClient(requireEnv("DATABASE_URL"));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
