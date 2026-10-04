import type { AppTransactionClient, DbClient } from "@/lib/server/db-types";

/** Runs `fn` in a transaction, or directly when `db` is already inside one (as in tests). */
export async function transact<T>(
  db: DbClient,
  fn: (tx: AppTransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in db) return db.$transaction(fn);
  return fn(db);
}
