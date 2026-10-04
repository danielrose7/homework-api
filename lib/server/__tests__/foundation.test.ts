import { describe, expect, it } from "vitest";

import { createAuth } from "@/lib/server/auth-factory";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

describe("foundation", () => {
  it("signs up a user by username, creates a school and checks the role", async () => {
    const db = testDb();
    const auth = createAuth(db);

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
    const token = signIn.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    const headers = new Headers({ authorization: `Bearer ${token}` });

    const school = await auth.api.createOrganization({
      body: { name: "Sandbox", slug: "sandbox" },
      headers,
    });
    expect(school?.slug).toBe("sandbox");

    const member = await db.member.findFirstOrThrow({
      where: { organizationId: school!.id },
    });
    expect(member.role).toBe("administrator");

    const allowed = await auth.api.hasPermission({
      headers,
      body: {
        organizationId: school!.id,
        permissions: { gradingScale: ["create"] },
      },
    });
    expect(allowed.success).toBe(true);

    const denied = await auth.api.hasPermission({
      headers,
      body: {
        organizationId: school!.id,
        permissions: { grade: ["create"] },
      },
    });
    expect(denied.success).toBe(false);
  });

  it("rolls back between tests", async () => {
    expect(await testDb().user.count()).toBe(0);
    expect(await testDb().organization.count()).toBe(0);
  });
});
