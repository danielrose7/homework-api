import { createAuth } from "@/lib/server/auth-factory";
import { prisma } from "@/lib/server/db";

/**
 * App-wide Better Auth instance, bound to the real database client. Tests must not import it: its writes
 * commit outside the per-test transaction. Use `createAuth(testDb())` instead.
 */
export const auth = createAuth(prisma);
