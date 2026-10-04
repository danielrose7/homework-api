import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { gradeSubmissionRoute as grade } from "@/app/api/v1/orgs/[orgSlug]/submissions/[submissionId]/grade/route";
import { getSubmissionRoute as getOne } from "@/app/api/v1/orgs/[orgSlug]/submissions/[submissionId]/route";
import { callRoute } from "@/test/http";
import { seedSubmission } from "@/test/scenarios/class";
import { withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

type Json = Record<string, unknown>;
const json = async (response: Response) => (await response.json()) as Json;
const errorOf = async (response: Response) =>
  (await json(response)).error as {
    code: string;
    details?: { field: string; code: string }[];
  };

async function setup() {
  const seeded = await seedSubmission({ assignment: { max_points: "100" } });
  const params = {
    orgSlug: seeded.school.organization.slug,
    submission_id: seeded.submission.id,
  };
  const teacher = seeded.school.teachers[0]!.headers;
  return { seeded, params, teacher };
}

describe("PUT /submissions/{id}/grade", () => {
  it("grades an ungraded submission and returns it", async () => {
    const { params, teacher } = await setup();

    const response = await callRoute(grade, params, {
      method: "PUT",
      headers: teacher,
      json: { points: 92, teacher_notes: "Nice work" },
    });

    expect(response.status).toBe(STATUS.ok);
    const body = await json(response);
    expect(body).toMatchObject({
      teacher_notes: "Nice work",
      grade: {
        label: "A",
        points_awarded: "92.00",
        max_points: "100.00",
        percent: "92.00",
      },
    });
    expect(body.object).toBe("submission");
  });

  it("accepts points as a string too", async () => {
    const { params, teacher } = await setup();

    const response = await callRoute(grade, params, {
      method: "PUT",
      headers: teacher,
      json: { points: "87.5" },
    });

    expect(response.status).toBe(STATUS.ok);
    expect((await json(response)).grade).toMatchObject({ label: "B" });
  });

  it("requires a reason to regrade", async () => {
    const { params, teacher } = await setup();
    await callRoute(grade, params, {
      method: "PUT",
      headers: teacher,
      json: { points: 92 },
    });
    const regrade = (extra: Json = {}) =>
      callRoute(grade, params, {
        method: "PUT",
        headers: teacher,
        json: { points: 71, ...extra },
      });

    const noReason = await regrade();
    const ok = await regrade({ reason: "Recount" });

    expect(noReason.status).toBe(STATUS.unprocessable_content);
    expect((await errorOf(noReason)).details?.[0]).toMatchObject({
      field: "reason",
      code: "reason_required",
    });
    expect(ok.status).toBe(STATUS.ok);
    expect((await json(ok)).grade).toMatchObject({ label: "C" });
  });

  it("answers 422 with every issue, named as the client sent them", async () => {
    const { params, teacher } = await setup();

    const response = await callRoute(grade, params, {
      method: "PUT",
      headers: teacher,
      json: { points: 150, teacher_notes: "x".repeat(5001) },
    });
    const unknown = await callRoute(grade, params, {
      method: "PUT",
      headers: teacher,
      json: { points: 90, comment: "hi" },
    });
    const malformed = await callRoute(grade, params, {
      method: "PUT",
      headers: teacher,
      raw: "{nope",
    });

    expect(response.status).toBe(STATUS.unprocessable_content);
    expect((await errorOf(response)).details?.map((d) => d.field)).toEqual([
      "points",
      "teacher_notes",
    ]);
    expect(unknown.status).toBe(STATUS.unprocessable_content);
    expect(malformed.status).toBe(STATUS.bad_request);
  });

  it("is for teachers of the class and administrators only", async () => {
    const { seeded, params } = await setup();
    const attempt = (headers: Headers) =>
      callRoute(grade, params, {
        method: "PUT",
        headers,
        json: { points: 90 },
      });

    const student = await attempt(seeded.school.students[0]!.headers);
    const anonymous = await callRoute(grade, params, {
      method: "PUT",
      json: { points: 90 },
    });
    const admin = await attempt(seeded.school.admin.headers);

    expect(student.status).toBe(STATUS.forbidden);
    expect(anonymous.status).toBe(STATUS.unauthorized);
    expect(admin.status).toBe(STATUS.ok);
  });

  it("answers 404 for a teacher from another school", async () => {
    const { params } = await setup();
    const other = await seedSubmission();

    const response = await callRoute(grade, params, {
      method: "PUT",
      headers: other.school.teachers[0]!.headers,
      json: { points: 90 },
    });

    expect(response.status).toBe(STATUS.not_found);
  });
});

describe("GET /submissions/{id}", () => {
  it("shows the owner their submission", async () => {
    const { seeded, params, teacher } = await setup();
    const student = seeded.school.students[0]!.headers;

    const before = await callRoute(getOne, params, { headers: student });
    await callRoute(grade, params, {
      method: "PUT",
      headers: teacher,
      json: { points: 92, teacher_notes: "Nice work" },
    });
    const after = await callRoute(getOne, params, { headers: student });

    expect(before.status).toBe(STATUS.ok);
    expect((await json(before)).grade).toBeNull();
    expect(await json(after)).toMatchObject({ teacher_notes: "Nice work" });
  });

  it("answers 404 to a classmate", async () => {
    const seeded = await seedSubmission({ students: 2 });

    const response = await callRoute(
      getOne,
      {
        orgSlug: seeded.school.organization.slug,
        submission_id: seeded.submission.id,
      },
      { headers: seeded.school.students[1]!.headers },
    );

    expect(response.status).toBe(STATUS.not_found);
  });
});
