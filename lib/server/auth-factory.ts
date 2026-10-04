import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { bearer, organization, username } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";

import type { DbClient } from "@/lib/server/db-types";
import { ac, roles } from "@/lib/server/permissions";
import { createDefaultGradingScale } from "@/lib/server/services/grading-scales";

export function createAuth(db: DbClient) {
  return betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: () => uuidv7() } },
    disabledPaths: ["/sign-in/email"],
    plugins: [
      username(),
      bearer(),
      organization({
        ac,
        roles,
        creatorRole: "administrator",
        organizationHooks: {
          afterCreateOrganization: async ({ organization: created }) => {
            await createDefaultGradingScale(db, created.id);
          },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
