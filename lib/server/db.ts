import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient(requireEnv("DATABASE_URL"));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
