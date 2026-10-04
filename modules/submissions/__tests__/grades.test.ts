import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { ApiError } from "@/lib/server/errors";
import { gradeSubmission } from "@/modules/submissions/mutations/grade-submission";
import {
  assignmentFactory,
  gradingScaleFactory,
  submissionFactory,
} from "@/test/factories/academics";
import { seedAssignment, seedSubmission } from "@/test/scenarios/class";
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

const codes = (error: ApiError) => error.details.map((d) => d.code);

async function ungraded(options: Parameters<typeof seedSubmission>[0] = {}) {
  const seeded = await seedSubmission(options);
  const teacher = await seeded.school.teachers[0]!.context();
  return { seeded, teacher, id: seeded.submission.id };
}

describe("first grade with points", () => {
  it("snapshots the band, writes history and logs the action", async () => {
    const { seeded, teacher, id } = await ungraded();

    const result = await gradeSubmission(teacher, id, {
      points: "93.5",
      teacher_notes: "Nice work",
    });

    expect(result.grade).toMatchObject({
      label: "A",
      group: "A",
      points_awarded: "93.5",
      max_points: "100",
      percent: "93.50",
    });
    expect(result.teacher_notes).toBe("Nice work");

    const row = await testDb().assignmentSubmission.findUniqueOrThrow({
      where: { id },
    });
    expect(row).toMatchObject({
      grade_label: "A",
      graded_by_id: seeded.school.teachers[0]!.member.id,
    });
    expect(row.graded_at?.toISOString()).toBe(result.graded_at);

    const events = await testDb().submissionGradeEvent.findMany({
      where: { submission_id: id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ grade_label: "A", reason: null });
    expect(String(events[0]?.max_points)).toBe("100");
    expect(events[0]?.created_at.toISOString()).toBe(result.graded_at);

    const log = await testDb().activityLog.findFirstOrThrow({
      where: { action: "grade" },
    });
    expect(log).toMatchObject({
      resource_type: "submission",
      resource_id: id,
      outcome: "success",
    });
  });

  it.each([
    ["90", "A"],
    ["89.99", "B"],
    ["70", "C"],
    ["60", "D"],
    ["59.99", "F"],
    ["0", "F"],
  ])("grades %s out of 100 as %s", async (points, expected) => {
    const { teacher, id } = await ungraded();
    const result = await gradeSubmission(teacher, id, { points });
    expect(result.grade.label).toBe(expected);
  });

  it("lets an administrator grade too", async () => {
    const { seeded, id } = await ungraded();
    const admin = await seeded.school.admin.context();
    const result = await gradeSubmission(admin, id, { points: "75" });
    expect(result.grade.label).toBe("C");
  });
});

describe("authorization", () => {
  it("forbids students", async () => {
    const { seeded, id } = await ungraded();
    const student = await seeded.school.students[0]!.context();
    expect(
      (await failure(gradeSubmission(student, id, { points: "100" }))).status,
    ).toBe(STATUS.forbidden);
  });

  it("hides the submission from a teacher who does not teach the class", async () => {
    const { seeded, id } = await ungraded({ teachers: 2 });
    await testDb().classTeacher.updateMany({
      where: { member_id: seeded.school.teachers[1]!.member.id },
      data: { deleted_at: new Date() },
    });
    const outsider = await seeded.school.teachers[1]!.context();
    expect(
      (await failure(gradeSubmission(outsider, id, { points: "100" }))).status,
    ).toBe(STATUS.not_found);
  });

  it("hides another school's submission", async () => {
    const { id } = await ungraded();
    const other = await seedAssignment();
    const foreign = await other.school.teachers[0]!.context();
    expect(
      (await failure(gradeSubmission(foreign, id, { points: "100" }))).status,
    ).toBe(STATUS.not_found);
  });

  it("treats unknown and deleted submissions as not found", async () => {
    const { teacher, seeded } = await ungraded();
    const missing = "00000000-0000-7000-8000-000000000000";
    expect(
      (await failure(gradeSubmission(teacher, missing, { points: "1" })))
        .status,
    ).toBe(STATUS.not_found);

    await testDb().assignmentSubmission.update({
      where: { id: seeded.submission.id },
      data: { deleted_at: new Date() },
    });
    expect(
      (
        await failure(
          gradeSubmission(teacher, seeded.submission.id, { points: "1" }),
        )
      ).status,
    ).toBe(STATUS.not_found);
  });
});

describe("validation", () => {
  it("rejects points above the maximum and reports all problems together", async () => {
    const { teacher, id } = await ungraded();
    const error = await failure(
      gradeSubmission(teacher, id, {
        points: "101",
        teacher_notes: "x".repeat(5001),
      }),
    );
    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(codes(error).sort()).toEqual(["exceeds_max_points", "too_long"]);
    expect(await testDb().submissionGradeEvent.count()).toBe(0);
  });

  it("rejects a grade request with nothing in it", async () => {
    const { teacher, id } = await ungraded();
    const error = await failure(gradeSubmission(teacher, id, {}));
    expect(codes(error)).toEqual(["grade_required"]);
  });
});

describe("Incomplete", () => {
  it("is chosen by name, stores no points, and can be replaced without a reason", async () => {
    const { teacher, id } = await ungraded();

    const first = await gradeSubmission(teacher, id, {
      band: "Incomplete",
      teacher_notes: "Missing page 2",
    });
    expect(first.grade).toMatchObject({
      label: "Incomplete",
      points_awarded: null,
      percent: null,
    });

    const replaced = await gradeSubmission(teacher, id, {
      points: "88",
    });
    expect(replaced.grade.label).toBe("B");
    expect(
      await testDb().submissionGradeEvent.count({
        where: { submission_id: id },
      }),
    ).toBe(2);
  });

  it("cannot be used to hand out a computed grade by name", async () => {
    const { teacher, id } = await ungraded();
    const error = await failure(gradeSubmission(teacher, id, { band: "A" }));
    expect(codes(error)).toEqual(["band_not_manual"]);
  });
});

describe("regrading", () => {
  it("requires a reason to regrade", async () => {
    const { teacher, id } = await ungraded();
    const first = await gradeSubmission(teacher, id, { points: "70" });

    const noReason = await failure(
      gradeSubmission(teacher, id, { points: "80" }),
    );
    expect(codes(noReason)).toEqual(["reason_required"]);

    const second = await gradeSubmission(teacher, id, {
      points: "80",
      reason: "Rubric applied late",
    });
    expect(second.grade.label).toBe("B");
    expect(new Date(second.graded_at).getTime()).toBeGreaterThanOrEqual(
      new Date(first.graded_at).getTime(),
    );
  });

  it("keeps the full history in order, one row per action", async () => {
    const { teacher, id } = await ungraded();
    await gradeSubmission(teacher, id, { points: "55" });
    await gradeSubmission(teacher, id, {
      points: "65",
      reason: "Rubric corrected",
    });
    await gradeSubmission(teacher, id, {
      points: "95",
      reason: "Parent meeting",
    });

    const events = await testDb().submissionGradeEvent.findMany({
      where: { submission_id: id },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
    });
    expect(events.map((e) => e.grade_label)).toEqual(["F", "D", "A"]);
    expect(events.map((e) => e.reason)).toEqual([
      null,
      "Rubric corrected",
      "Parent meeting",
    ]);
  });

  it("keeps using the scale the grade was first given on, even if the school default moves", async () => {
    const { seeded, teacher, id } = await ungraded();
    const first = await gradeSubmission(teacher, id, { points: "91" });

    await gradingScaleFactory
      .plusMinus()
      .asDefault()
      .create({ organization_id: seeded.school.organization.id });

    const second = await gradeSubmission(teacher, id, {
      points: "91",
      reason: "Checking scale",
    });
    expect(second.grade.label).toBe("A");
    expect(second.grade.scaleId).toBe(first.grade.scaleId);
  });
});

describe("scale overrides and pass/fail", () => {
  it("uses an assignment's own scale: pass at 60%", async () => {
    const seeded = await seedAssignment();
    const passFail = await gradingScaleFactory
      .passFail()
      .create({ organization_id: seeded.school.organization.id });
    const assignment = await assignmentFactory.create({
      class_id: seeded.klass.id,
      grading_scale_id: passFail.id,
    });
    const submission = await submissionFactory.create({
      assignment_id: assignment.id,
      class_seat_id: seeded.seats[0]!.id,
    });
    const teacher = await seeded.school.teachers[0]!.context();

    const result = await gradeSubmission(teacher, submission.id, {
      points: "60",
    });
    expect(result.grade).toMatchObject({ label: "Pass", scaleId: passFail.id });
  });

  it("grades band-mode work by choosing a result, with no points", async () => {
    const seeded = await seedAssignment();
    const passFail = await gradingScaleFactory
      .passFail()
      .create({ organization_id: seeded.school.organization.id });
    const assignment = await assignmentFactory.passFail().create({
      class_id: seeded.klass.id,
      grading_scale_id: passFail.id,
    });
    const submission = await submissionFactory.create({
      assignment_id: assignment.id,
      class_seat_id: seeded.seats[0]!.id,
    });
    const teacher = await seeded.school.teachers[0]!.context();

    const wrong = await failure(
      gradeSubmission(teacher, submission.id, { points: "10" }),
    );
    expect(codes(wrong)).toEqual(["points_not_allowed", "band_required"]);

    const result = await gradeSubmission(teacher, submission.id, {
      band: "fail",
    });
    expect(result.grade).toMatchObject({
      label: "Fail",
      points_awarded: null,
      max_points: null,
      percent: null,
    });
  });
});
