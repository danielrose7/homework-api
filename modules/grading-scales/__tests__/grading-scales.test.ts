import { describe, expect, it } from "vitest";

import { PASS_FAIL, PLUS_MINUS, STANDARD_AF } from "@/lib/domain/grading";
import { STATUS } from "@/lib/http-status";
import { createAuth } from "@/lib/server/auth-factory";
import { ApiError } from "@/lib/server/errors";
import { createGradingScale } from "@/modules/grading-scales/mutations/create-grading-scale";
import { setDefaultGradingScale } from "@/modules/grading-scales/mutations/set-default-grading-scale";
import { getGradingScale } from "@/modules/grading-scales/queries/get-grading-scale";
import { listGradingScales } from "@/modules/grading-scales/queries/list-grading-scales";
import { resolveGradingScale } from "@/modules/grading-scales/queries/resolve-grading-scale";
import { seedSchool } from "@/test/scenarios/school";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ApiError)) throw new Error("expected an ApiError");
  return error;
}

describe("default grading scale", () => {
  it("is created for every school made through the factories", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    const scales = await listGradingScales(ctx);
    expect(scales).toHaveLength(1);
    expect(scales[0]).toMatchObject({ name: "Standard A–F", isDefault: true });
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
      where: { organizationId: school!.id },
    });
    expect(scales).toHaveLength(1);
    expect(scales[0]?.isDefault).toBe(true);
  });
});

describe("createGradingScale", () => {
  it("lets an administrator create a scale and records it", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();

    const scale = await createGradingScale(ctx, {
      name: "Plus/minus",
      bands: [...PLUS_MINUS],
    });

    expect(scale.isDefault).toBe(false);
    expect(scale.bands).toHaveLength(PLUS_MINUS.length);
    expect(scale.bands[0]?.label).toBe("A+");
    const log = await testDb().activityLog.findFirstOrThrow({
      where: { resourceId: scale.id },
    });
    expect(log).toMatchObject({
      action: "create",
      resourceType: "grading_scale",
    });
  });

  it("forbids teachers and students", async () => {
    const school = await seedSchool();
    for (const persona of [school.teachers[0]!, school.students[0]!]) {
      const error = await failure(
        createGradingScale(await persona.context(), {
          name: "Mine",
          bands: [...STANDARD_AF],
        }),
      );
      expect(error.status).toBe(STATUS.forbidden);
    }
  });

  it("reports every validation problem at once as 422", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    const error = await failure(
      createGradingScale(ctx, {
        name: " ",
        bands: [
          {
            label: "A",
            groupLabel: null,
            minPercent: "50",
            gpaPoints: null,
            isPassing: true,
            countsInAverage: true,
          },
          {
            label: "a",
            groupLabel: null,
            minPercent: "50",
            gpaPoints: null,
            isPassing: true,
            countsInAverage: true,
          },
        ],
      }),
    );
    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(error.details.map((d) => d.code).sort()).toEqual(
      [
        "duplicate_label",
        "duplicate_threshold",
        "missing_zero_band",
        "name_required",
      ].sort(),
    );
  });

  it("rejects a name already used in the school", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    const error = await failure(
      createGradingScale(ctx, {
        name: "Standard A–F",
        bands: [...STANDARD_AF],
      }),
    );
    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(error.details[0]?.code).toBe("name_taken");
  });

  it("moves the default when asked", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    const created = await createGradingScale(ctx, {
      name: "Plus/minus",
      isDefault: true,
      bands: [...PLUS_MINUS],
    });
    const scales = await listGradingScales(ctx);
    expect(scales.filter((s) => s.isDefault).map((s) => s.id)).toEqual([
      created.id,
    ]);
  });
});

describe("setDefaultGradingScale", () => {
  it("switches the default and keeps exactly one", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    const passFail = await createGradingScale(ctx, {
      name: "Pass/Fail",
      bands: [...PASS_FAIL],
    });

    await setDefaultGradingScale(ctx, passFail.id);

    const scales = await listGradingScales(ctx);
    expect(scales.filter((s) => s.isDefault)).toHaveLength(1);
    expect(scales.find((s) => s.isDefault)?.name).toBe("Pass/Fail");
  });

  it("treats another school's scale as not found", async () => {
    const school = await seedSchool();
    const other = await seedSchool();
    const otherScale = (
      await listGradingScales(await other.admin.context())
    )[0]!;

    const error = await failure(
      setDefaultGradingScale(await school.admin.context(), otherScale.id),
    );
    expect(error.status).toBe(STATUS.not_found);
    const read = await failure(
      getGradingScale(await school.admin.context(), otherScale.id),
    );
    expect(read.status).toBe(STATUS.not_found);
  });

  it("is limited to administrators", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    const scale = (await listGradingScales(ctx))[0]!;
    const error = await failure(
      setDefaultGradingScale(await school.teachers[0]!.context(), scale.id),
    );
    expect(error.status).toBe(STATUS.forbidden);
  });
});

describe("resolveGradingScale", () => {
  it("prefers the assignment's scale, then the class's, then the school default", async () => {
    const school = await seedSchool();
    const ctx = await school.admin.context();
    const schoolDefault = (await listGradingScales(ctx))[0]!;
    const classScale = await createGradingScale(ctx, {
      name: "Plus/minus",
      bands: [...PLUS_MINUS],
    });
    const assignmentScale = await createGradingScale(ctx, {
      name: "Pass/Fail",
      bands: [...PASS_FAIL],
    });
    const organizationId = ctx.organizationId;

    const resolve = (
      assignmentScaleId: string | null,
      classScaleId: string | null,
    ) =>
      resolveGradingScale(testDb(), {
        organizationId,
        assignmentScaleId,
        classScaleId,
      });

    expect((await resolve(assignmentScale.id, classScale.id)).id).toBe(
      assignmentScale.id,
    );
    expect((await resolve(null, classScale.id)).id).toBe(classScale.id);
    expect((await resolve(null, null)).id).toBe(schoolDefault.id);
  });
});
