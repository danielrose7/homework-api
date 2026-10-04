import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { submitRoute as submit } from "@/app/api/v1/orgs/[orgSlug]/assignments/[assignmentId]/submissions/route";
import { gradeSubmissionRoute as grade } from "@/app/api/v1/orgs/[orgSlug]/submissions/[submissionId]/grade/route";
import { getSubmissionRoute as getOne } from "@/app/api/v1/orgs/[orgSlug]/submissions/[submissionId]/route";
import { listOwnRoute as listMine } from "@/app/api/v1/orgs/[orgSlug]/submissions/me/route";
import { callRoute } from "@/test/http";
import { seedAssignment, seedSubmission } from "@/test/scenarios/class";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

const denials = () =>
  testDb().activityLog.findMany({ where: { action: "denied" } });

describe("denial logging", () => {
  it("logs a 403 against the resource, with ids only", async () => {
    const seeded = await seedSubmission();
    const student = seeded.school.students[0]!;

    const response = await callRoute(
      grade,
      {
        orgSlug: seeded.school.organization.slug,
        submissionId: seeded.submission.id,
      },
      { method: "PUT", headers: student.headers, json: { points: 90 } },
    );

    expect(response.status).toBe(STATUS.forbidden);
    expect(await denials()).toMatchObject([
      {
        outcome: "denied",
        resourceType: "submission",
        resourceId: seeded.submission.id,
        actorRole: "student",
        actorMemberId: student.member.id,
        organizationId: seeded.school.organization.id,
        metadata: { method: "PUT" },
      },
    ]);
  });

  it("logs a classmate's attempt even though it answers 404", async () => {
    const seeded = await seedSubmission({ students: 2 });
    const classmate = seeded.school.students[1]!;

    const response = await callRoute(
      getOne,
      {
        orgSlug: seeded.school.organization.slug,
        submissionId: seeded.submission.id,
      },
      { headers: classmate.headers },
    );

    expect(response.status).toBe(STATUS.not_found);
    expect(await denials()).toMatchObject([
      {
        resourceType: "submission",
        resourceId: seeded.submission.id,
        actorMemberId: classmate.member.id,
      },
    ]);
  });

  it("logs a teacher who does not teach the class", async () => {
    const seeded = await seedSubmission({ teachers: 2 });
    const outsider = seeded.school.teachers[1]!;
    await testDb().classTeacher.updateMany({
      where: { classId: seeded.klass.id, memberId: outsider.member.id },
      data: { deletedAt: new Date() },
    });

    const response = await callRoute(
      getOne,
      {
        orgSlug: seeded.school.organization.slug,
        submissionId: seeded.submission.id,
      },
      { headers: outsider.headers },
    );

    expect(response.status).toBe(STATUS.not_found);
    expect(await denials()).toMatchObject([{ actorRole: "teacher" }]);
  });

  it("logs a dropped student who tries to submit, against the assignment", async () => {
    const seeded = await seedAssignment();
    await testDb().classSeat.update({
      where: { id: seeded.seats[0]!.id },
      data: { status: "dropped", droppedAt: new Date() },
    });

    const response = await callRoute(
      submit,
      {
        orgSlug: seeded.school.organization.slug,
        assignmentId: seeded.assignment.id,
      },
      { headers: seeded.school.students[0]!.headers, json: { text: "late" } },
    );

    expect(response.status).toBe(STATUS.forbidden);
    expect(await denials()).toMatchObject([
      { resourceType: "assignment", resourceId: seeded.assignment.id },
    ]);
  });

  it("does not log a plain 404, a 401, or a request that was allowed", async () => {
    const seeded = await seedSubmission();
    const params = { orgSlug: seeded.school.organization.slug };
    const missing = "0198f0f0-0000-7000-8000-000000000000";

    await callRoute(
      getOne,
      { ...params, submissionId: missing },
      { headers: seeded.school.admin.headers },
    );
    await callRoute(listMine, params);
    await callRoute(listMine, params, {
      headers: seeded.school.students[0]!.headers,
    });

    expect(await denials()).toEqual([]);
  });
});

describe("read logging", () => {
  it("logs a single-record read, but not a list or the fetch after a grade", async () => {
    const seeded = await seedSubmission();
    const params = {
      orgSlug: seeded.school.organization.slug,
      submissionId: seeded.submission.id,
    };
    const teacher = seeded.school.teachers[0]!;
    const reads = () =>
      testDb().activityLog.findMany({
        where: { action: "read", resourceType: "submission" },
      });

    await callRoute(grade, params, {
      method: "PUT",
      headers: teacher.headers,
      json: { points: 90 },
    });
    await callRoute(
      listMine,
      { orgSlug: params.orgSlug },
      { headers: seeded.school.students[0]!.headers },
    );
    expect(await reads()).toEqual([]);

    await callRoute(getOne, params, { headers: teacher.headers });
    expect(await reads()).toMatchObject([
      {
        resourceId: seeded.submission.id,
        actorMemberId: teacher.member.id,
        outcome: "success",
      },
    ]);
  });
});
