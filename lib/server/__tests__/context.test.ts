import { beforeEach, describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { createAuth } from "@/lib/server/auth-factory";
import {
  requirePermission,
  requireRole,
  resolveContext,
} from "@/lib/server/context";
import { ApiError } from "@/lib/server/errors";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

const password = "correct-horse-battery";

async function signUp(auth: ReturnType<typeof createAuth>, username: string) {
  await auth.api.signUpEmail({
    body: {
      name: username,
      email: `${username}@sandbox.test`,
      password,
      username,
    },
  });
  const signIn = await auth.api.signInUsername({
    body: { username, password },
    returnHeaders: true,
  });
  return new Headers({
    authorization: `Bearer ${signIn.headers.get("set-auth-token")}`,
  });
}

async function expectApiError(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ApiError)) throw new Error("expected an ApiError");
  expect(error.status).toBe(status);
}

describe("resolveContext", () => {
  let auth: ReturnType<typeof createAuth>;
  let adminHeaders: Headers;
  let schoolId: string;

  beforeEach(async () => {
    auth = createAuth(testDb());
    adminHeaders = await signUp(auth, "alvarez");
    const school = await auth.api.createOrganization({
      body: { name: "Sandbox", slug: "sandbox" },
      headers: adminHeaders,
    });
    schoolId = school!.id;
  });

  it("resolves the school, member and role for a member", async () => {
    const ctx = await resolveContext({
      auth,
      db: testDb(),
      headers: adminHeaders,
      organizationSlug: "sandbox",
    });
    expect(ctx.organization_id).toBe(schoolId);
    expect(ctx.role).toBe("administrator");
  });

  it("rejects requests with no credentials as 401", async () => {
    await expectApiError(
      resolveContext({
        auth,
        db: testDb(),
        headers: new Headers(),
        organizationSlug: "sandbox",
      }),
      STATUS.unauthorized,
    );
  });

  it("treats a non-member and an unknown school the same: 404", async () => {
    const outsider = await signUp(auth, "chen");
    await expectApiError(
      resolveContext({
        auth,
        db: testDb(),
        headers: outsider,
        organizationSlug: "sandbox",
      }),
      STATUS.not_found,
    );
    await expectApiError(
      resolveContext({
        auth,
        db: testDb(),
        headers: outsider,
        organizationSlug: "no-such-school",
      }),
      STATUS.not_found,
    );
  });

  it("enforces roles and permissions with 403", async () => {
    const studentHeaders = await signUp(auth, "maya");
    const student = await testDb().user.findUniqueOrThrow({
      where: { username: "maya" },
    });
    await testDb().member.create({
      data: { organizationId: schoolId, userId: student.id, role: "student" },
    });

    const ctx = await resolveContext({
      auth,
      db: testDb(),
      headers: studentHeaders,
      organizationSlug: "sandbox",
    });
    expect(ctx.role).toBe("student");
    expect(() => requireRole(ctx, "administrator", "teacher")).toThrow(
      ApiError,
    );
    expect(() => requireRole(ctx, "student")).not.toThrow();
    expect(() =>
      requirePermission(ctx, { submission: ["create"] }),
    ).not.toThrow();
    expect(() => requirePermission(ctx, { grade: ["update"] })).toThrow(
      ApiError,
    );
  });
});
