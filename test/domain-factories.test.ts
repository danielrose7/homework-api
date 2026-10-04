import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { requireTeachesClass } from "@/modules/academics/queries/access";

import { assignmentFactory, submissionFactory } from "./factories/academics";
import { testDb, withRollbackDb } from "./rollback-db";
import { seedAssignment, seedClass, seedSubmission } from "./scenarios/class";

withRollbackDb();

describe("seedClass", () => {
  it("builds a term, a class, its teacher and a seat for every student", async () => {
    const seeded = await seedClass({ teachers: 1, students: 2 });
    expect(seeded.seats).toHaveLength(2);
    expect(seeded.klass.organization_id).toBe(seeded.school.organization.id);

    const teacher = await seeded.school.teachers[0]!.context();
    await expect(
      requireTeachesClass(teacher, seeded.klass.id),
    ).resolves.toBeUndefined();
    expect(
      await testDb().classSeat.count({ where: { class_id: seeded.klass.id } }),
    ).toBe(2);
  });

  it("keeps two seeded schools apart", async () => {
    const a = await seedClass();
    const b = await seedClass();
    expect(a.klass.organization_id).not.toBe(b.klass.organization_id);
    const teacherOfB = await b.school.teachers[0]!.context();
    await expect(
      requireTeachesClass(teacherOfB, a.klass.id),
    ).rejects.toMatchObject({
      status: STATUS.not_found,
    });
  });
});

describe("assignment factory traits", () => {
  it("defaults to a published, points-graded homework", async () => {
    const { assignment } = await seedAssignment();
    expect(assignment).toMatchObject({
      type: "homework",
      grading_mode: "points",
      max_points: "100",
      max_submissions: 1,
    });
    expect(assignment.published_at).toBeInstanceOf(Date);
  });

  it("supports pass/fail, draft, past due, multi-attempt and deleted", async () => {
    const { klass } = await seedClass();
    const create = (factory: typeof assignmentFactory) =>
      factory.create({ class_id: klass.id });

    const pass_fail = await create(assignmentFactory.passFail());
    expect(pass_fail).toMatchObject({ grading_mode: "band", max_points: null });

    expect((await create(assignmentFactory.draft())).published_at).toBeNull();
    const pastDue = await create(assignmentFactory.pastDue());
    expect(pastDue.due_at!.getTime()).toBeLessThan(Date.now());
    expect(
      (await create(assignmentFactory.multiAttempt(4))).max_submissions,
    ).toBe(4);
    expect((await create(assignmentFactory.exam())).type).toBe("exam");

    const deleted = await create(assignmentFactory.deleted());
    expect(
      await testDb().assignment.findUnique({ where: { id: deleted.id } }),
    ).toBeNull();
  });
});

describe("submission factory", () => {
  it("is ungraded by default", async () => {
    const { submission } = await seedSubmission();
    expect(submission.graded_at).toBeNull();
    const row = await testDb().assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(row.grade_band_id).toBeNull();
    expect(await testDb().submissionGradeEvent.count()).toBe(0);
  });

  it("graded() snapshots the band and writes the matching history row", async () => {
    const { submission } = await seedSubmission({
      grade: { points: "92" },
      notes: "Great",
    });
    const row = await testDb().assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(row).toMatchObject({
      grade_label: "A",
      grade_group: "A",
      teacher_notes: "Great",
    });
    expect(String(row.points_awarded)).toBe("92");
    expect(row.graded_at?.toISOString()).toBe(submission.graded_at);

    const events = await testDb().submissionGradeEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]?.created_at.toISOString()).toBe(submission.graded_at);
    expect(events[0]?.grade_label).toBe("A");
  });

  it("incomplete() records the manual band with no points", async () => {
    const { submission } = await seedSubmission({
      grade: { band: "Incomplete" },
    });
    const row = await testDb().assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(row.grade_label).toBe("Incomplete");
    expect(row.points_awarded).toBeNull();
  });

  it("can attach to an existing assignment and seat", async () => {
    const seeded = await seedAssignment({ students: 2 });
    const made = await submissionFactory.create({
      assignment_id: seeded.assignment.id,
      class_seat_id: seeded.seats[1]!.id,
    });
    expect(made.assignment_id).toBe(seeded.assignment.id);
  });
});
