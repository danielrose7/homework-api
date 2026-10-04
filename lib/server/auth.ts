import { createAuth } from "@/lib/server/auth-factory";
import { prisma } from "@/lib/server/db";

export const auth = createAuth(prisma);
