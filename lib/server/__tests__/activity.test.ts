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
    const resourceId = ctx.memberId;

    await recordActivity(testDb(), ctx, {
      action: "read",
      resourceType: "submission",
      resourceId,
      metadata: { assignmentId: resourceId, changedFields: ["teacherNotes"] },
    });

    const row = await testDb().activityLog.findFirstOrThrow();
    expect(row).toMatchObject({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorUserId: ctx.userId,
      actorMemberId: ctx.memberId,
      actorRole: "teacher",
      action: "read",
      resourceType: "submission",
      resourceId,
      outcome: "success",
      requestId: ctx.requestId,
    });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("refuses metadata that could carry personal or graded content", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();

    for (const key of ["name", "email", "teacherNotes", "points", "Title"]) {
      await expect(
        recordActivity(testDb(), ctx, {
          action: "update",
          resourceType: "assignment",
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
      resourceType: "class",
    });
    const row = await testDb().activityLog.findFirstOrThrow();
    expect(row.ipAddress).toBe("203.0.113.9");
    expect(row.userAgent).toBe("curl/8.0");
  });

  it("is append-only in the client", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    await recordActivity(testDb(), ctx, {
      action: "read",
      resourceType: "class",
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
      resourceType: "class",
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
      resourceType: "class",
    });

    const other = createPrismaClient(testEnv.appUrl);
    try {
      expect(await other.activityLog.count()).toBe(0);
    } finally {
      await other.$disconnect();
    }
  });
});
