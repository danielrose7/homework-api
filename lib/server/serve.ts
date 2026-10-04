import { auth } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { createServe } from "@/lib/server/route";

/** Runs route definitions against the real auth and database. Tests use `createServe` with their own. */
export const serve = createServe({ auth, db: prisma });
