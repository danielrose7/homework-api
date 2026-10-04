import { describe, expect, it } from "vitest";

import { createAuth } from "@/lib/server/auth-factory";
import { resolveGradingScale } from "@/modules/grading-scales/queries/resolve-grading-scale";
import { gradingScaleFactory } from "@/test/factories/academics";
import { seedSchool } from "@/test/scenarios/school";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

describe("default grading scale", () => {
  it("is created for every school made through the factories", async () => {
    const school = await seedSchool();
    const scales = await testDb().gradingScale.findMany({
      where: { organization_id: school.organization.id },
      include: { bands: { orderBy: { sort_order: "asc" } } },
    });
    expect(scales).toHaveLength(1);
    expect(scales[0]).toMatchObject({ name: "Standard A–F", is_default: true });
    expect(scales[0]?.bands.map((b) => b.label)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "F",
      "Incomplete",
    ]);
  });

  it("is created by Better Auth when a school is created through the API", async () => {
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
    const headers = new Headers({
      authorization: `Bearer ${signIn.headers.get("set-auth-token")}`,
    });
    const school = await auth.api.createOrganization({
      body: { name: "Sandbox", slug: "sandbox" },
      headers,
    });

    const scales = await testDb().gradingScale.findMany({
      where: { organization_id: school!.id },
    });
    expect(scales).toHaveLength(1);
    expect(scales[0]?.is_default).toBe(true);
  });
});

describe("resolveGradingScale", () => {
  it("prefers the assignment's scale, then the class's, then the school default", async () => {
    const school = await seedSchool();
    const organization_id = school.organization.id;
    const school_default = await testDb().gradingScale.findFirstOrThrow({
      where: { organization_id, is_default: true },
    });
    const classScale = await gradingScaleFactory
      .plusMinus()
      .create({ organization_id });
    const assignmentScale = await gradingScaleFactory
      .passFail()
      .create({ organization_id });

    const resolve = (
      assignment_scale_id: string | null,
      class_scale_id: string | null,
    ) =>
      resolveGradingScale(testDb(), {
        organization_id,
        assignment_scale_id,
        class_scale_id,
      });

    expect((await resolve(assignmentScale.id, classScale.id)).id).toBe(
      assignmentScale.id,
    );
    expect((await resolve(null, classScale.id)).id).toBe(classScale.id);
    expect((await resolve(null, null)).id).toBe(school_default.id);
  });
});
