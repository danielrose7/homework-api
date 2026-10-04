import { describe, expect, it } from "vitest";

import { recordActivity } from "@/lib/server/activity";
import { createPrismaClient } from "@/lib/server/db";
import { seedSchool } from "@/test/scenarios/school";
import { testEnv } from "@/test/env.ts";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

describe("recordActivity", () => {
  it("records who did what to which resource, with ids only", async () => {
    const school = await seedSchool();
    const ctx = await school.teachers[0]!.context();
    const resource_id = ctx.member_id;

    await recordActivity(testDb(), ctx, {
      action: "read",
      resource_type: "submission",
      resource_id,
      metadata: {
        assignment_id: resource_id,
        changedFields: ["teacher_notes"],
      },
    });

    const row = await testDb().activityLog.findFirstOrThrow();
    expect(row).toMatchObject({
      organization_id: ctx.organization_id,
      actor_type: "user",
      actor_user_id: ctx.userId,
      actor_member_id: ctx.member_id,
      actor_role: "teacher",
      action: "read",
      resource_type: "submission",
      resource_id,
      outcome: "success",
      request_id: ctx.request_id,
    });
    expect(row.created_at).toBeInstanceOf(Date);
  });

  it("refuses metadata that could carry personal or graded content", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();

    for (const key of ["name", "email", "teacher_notes", "points", "Title"]) {
      await expect(
        recordActivity(testDb(), ctx, {
          action: "update",
          resource_type: "assignment",
          metadata: { [key]: "x" },
        }),
      ).rejects.toThrow(/ids and field names only/);
    }
    expect(await testDb().activityLog.count()).toBe(0);
  });

  it("captures the caller's address and user agent from the request", async () => {
    const school = await seedSchool();
    const headers = new Headers(school.admin.headers);
    headers.set("x-forwarded-for", "203.0.113.9, 10.0.0.1");
    headers.set("user-agent", "curl/8.0");
    const { resolveContext } = await import("@/lib/server/context");
    const { factoryAuth } = await import("@/test/factories/runtime");
    const ctx = await resolveContext({
      auth: factoryAuth(),
      db: testDb(),
      headers,
      organizationSlug: school.organization.slug,
    });
    await recordActivity(testDb(), ctx, {
      action: "read",
      resource_type: "class",
    });
    const row = await testDb().activityLog.findFirstOrThrow();
    expect(row.ip_address).toBe("203.0.113.9");
    expect(row.user_agent).toBe("curl/8.0");
  });

  it("is append-only in the client", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    await recordActivity(testDb(), ctx, {
      action: "read",
      resource_type: "class",
    });
    const db = testDb();

    await expect(
      db.activityLog.updateMany({ data: { action: "delete" } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.activityLog.deleteMany()).rejects.toThrow(/append-only/);
    await expect(db.submissionGradeEvent.deleteMany()).rejects.toThrow(
      /append-only/,
    );
  });

  it("is append-only in the database for the runtime role", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    await recordActivity(testDb(), ctx, {
      action: "read",
      resource_type: "class",
    });

    await expect(
      testDb().$executeRaw`UPDATE "activity_log" SET "action" = 'delete'`,
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot be seen from another connection until committed", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    await recordActivity(testDb(), ctx, {
      action: "read",
      resource_type: "class",
    });

    const other = createPrismaClient(testEnv.appUrl);
    try {
      expect(await other.activityLog.count()).toBe(0);
    } finally {
      await other.$disconnect();
    }
  });
});
