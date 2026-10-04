import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { createPrismaClient } from "@/lib/server/db";
import { resolveContext } from "@/lib/server/context";
import { ApiError } from "@/lib/server/errors";

import { factoryAuth } from "./factories/runtime";
import { memberFactory } from "./factories/member";
import { userFactory } from "./factories/user";
import { testEnv } from "./env.ts";
import { withRollbackDb, testDb } from "./rollback-db";
import { seedSchool } from "./scenarios/school";

withRollbackDb();

describe("userFactory", () => {
  it("creates users that can really sign in", async () => {
    const user = await userFactory.create();
    const result = await factoryAuth().api.signInUsername({
      body: { username: user.username, password: user.password },
    });
    expect(result.user.id).toBe(user.id);
  });

  it("build() does not touch the database", async () => {
    userFactory.build();
    expect(await testDb().user.count()).toBe(0);
  });

  it("gives each user a distinct username and email", async () => {
    const a = await userFactory.create();
    const b = await userFactory.create();
    expect(a.username).not.toBe(b.username);
    expect(a.email).not.toBe(b.email);
  });
});

describe("memberFactory", () => {
  it("creates its own user and school and applies role traits", async () => {
    const teacher = await memberFactory.teacher().create();
    expect(teacher.role).toBe("teacher");
    expect(teacher.user.id).toBe(teacher.userId);
    expect(teacher.organization.id).toBe(teacher.organizationId);
  });
});

describe("seedSchool", () => {
  it("seeds as many teachers and students as asked, including none", async () => {
    const big = await seedSchool({ teachers: 2, students: 3 });
    expect(big.teachers).toHaveLength(2);
    expect(big.students).toHaveLength(3);

    const empty = await seedSchool({ teachers: 0, students: 0 });
    expect(empty.teachers).toHaveLength(0);
    expect(empty.students).toHaveLength(0);
    expect((await empty.admin.context()).role).toBe("administrator");
  });

  it("returns signed-in personas with the right roles", async () => {
    const school = await seedSchool();
    expect(school.teachers).toHaveLength(1);
    expect(school.students).toHaveLength(1);

    const adminContext = await school.admin.context();
    const studentContext = await school.students[0]!.context();
    expect(adminContext.role).toBe("administrator");
    expect(studentContext.role).toBe("student");
    expect(studentContext.organizationId).toBe(school.organization.id);
  });

  it("keeps two schools apart: a member of one is a stranger to the other", async () => {
    const school = await seedSchool();
    const other = await seedSchool();
    const outsider = other.students[0]!;
    const error = await resolveFor(outsider.headers, school.organization.slug);
    if (!(error instanceof ApiError)) throw new Error("expected an ApiError");
    expect(error.status).toBe(STATUS.not_found);
  });
});

async function resolveFor(headers: Headers, slug: string) {
  return resolveContext({
    auth: factoryAuth(),
    db: testDb(),
    headers,
    organizationSlug: slug,
  }).then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe("isolation", () => {
  it("keeps factory and Better Auth writes inside the test transaction", async () => {
    const school = await seedSchool();
    expect(await testDb().user.count()).toBeGreaterThan(0);

    const otherConnection = createPrismaClient(testEnv.appUrl);
    try {
      expect(await otherConnection.user.count()).toBe(0);
      expect(
        await otherConnection.organization.findUnique({
          where: { slug: school.organization.slug },
        }),
      ).toBeNull();
    } finally {
      await otherConnection.$disconnect();
    }
  });
});
