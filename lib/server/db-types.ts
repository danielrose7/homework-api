import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;
