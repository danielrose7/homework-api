import type { AppPrismaClient } from "@/lib/server/db";

export type AppTransactionClient = Parameters<
  Parameters<AppPrismaClient["$transaction"]>[0]
>[0];

export type DbClient = AppPrismaClient | AppTransactionClient;
