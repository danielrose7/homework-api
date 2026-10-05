import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { bearer, organization, username } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";

import type { DbClient } from "@/lib/server/db-types";
import { ac, roles } from "@/lib/server/permissions";
import { provisionOrganization } from "@/modules/organizations/mutations/provision-organization";

interface AuthFactoryOptions {
  provision?: typeof provisionOrganization;
}

export function createAuth(db: DbClient, options: AuthFactoryOptions = {}) {
  const provision = options.provision ?? provisionOrganization;
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
            try {
              await provision(db, created.id);
            } catch (error) {
              await db.organization.delete({ where: { id: created.id } });
              throw error;
            }
          },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
