import { describe, expect, it } from "vitest";

import { createAuth } from "@/lib/server/auth-factory";
import { seedSchool } from "@/test/scenarios/school";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

describe("organization preferences", () => {
  it("default to New York time for schools made through the factories", async () => {
    const school = await seedSchool();

    const preferences =
      await testDb().organizationPreferences.findUniqueOrThrow({
        where: { organization_id: school.organization.id },
      });
    expect(preferences.timezone).toBe("America/New_York");
  });

  it("are created by Better Auth when a school is created through the API", async () => {
    const auth = createAuth(testDb());
    await auth.api.signUpEmail({
      body: {
        name: "Ms. Alvarez",
        email: "alvarez@sandbox.test",
        password: "correct-horse-battery",
        username: "alvarez",
      },
    });
    const signIn = await auth.api.signInUsername({
      body: { username: "alvarez", password: "correct-horse-battery" },
      returnHeaders: true,
    });
    const school = await auth.api.createOrganization({
      body: { name: "Sandbox", slug: "sandbox" },
      headers: new Headers({
        authorization: `Bearer ${signIn.headers.get("set-auth-token")}`,
      }),
    });

    const preferences =
      await testDb().organizationPreferences.findUniqueOrThrow({
        where: { organization_id: school!.id },
      });
    expect(preferences.timezone).toBe("America/New_York");
  });
});
