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
    expect(seeded.klass.organizationId).toBe(seeded.school.organization.id);

    const teacher = await seeded.school.teachers[0]!.context();
    await expect(
      requireTeachesClass(teacher, seeded.klass.id),
    ).resolves.toBeUndefined();
    expect(
      await testDb().classSeat.count({ where: { classId: seeded.klass.id } }),
    ).toBe(2);
  });

  it("keeps two seeded schools apart", async () => {
    const a = await seedClass();
    const b = await seedClass();
    expect(a.klass.organizationId).not.toBe(b.klass.organizationId);
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
      gradingMode: "points",
      maxPoints: "100",
      maxSubmissions: 1,
    });
    expect(assignment.publishedAt).toBeInstanceOf(Date);
  });

  it("supports pass/fail, draft, past due, multi-attempt and deleted", async () => {
    const { klass } = await seedClass();
    const create = (factory: typeof assignmentFactory) =>
      factory.create({ classId: klass.id });

    const passFail = await create(assignmentFactory.passFail());
    expect(passFail).toMatchObject({ gradingMode: "band", maxPoints: null });

    expect((await create(assignmentFactory.draft())).publishedAt).toBeNull();
    const pastDue = await create(assignmentFactory.pastDue());
    expect(pastDue.dueAt!.getTime()).toBeLessThan(Date.now());
    expect(
      (await create(assignmentFactory.multiAttempt(4))).maxSubmissions,
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
    expect(submission.gradedAt).toBeNull();
    const row = await testDb().assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(row.gradeBandId).toBeNull();
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
      gradeLabel: "A",
      gradeGroup: "A",
      teacherNotes: "Great",
    });
    expect(String(row.pointsAwarded)).toBe("92");
    expect(row.gradedAt?.toISOString()).toBe(submission.gradedAt);

    const events = await testDb().submissionGradeEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]?.createdAt.toISOString()).toBe(submission.gradedAt);
    expect(events[0]?.gradeLabel).toBe("A");
  });

  it("incomplete() records the manual band with no points", async () => {
    const { submission } = await seedSubmission({
      grade: { band: "Incomplete" },
    });
    const row = await testDb().assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(row.gradeLabel).toBe("Incomplete");
    expect(row.pointsAwarded).toBeNull();
  });

  it("can attach to an existing assignment and seat", async () => {
    const seeded = await seedAssignment({ students: 2 });
    const made = await submissionFactory.create({
      assignmentId: seeded.assignment.id,
      classSeatId: seeded.seats[1]!.id,
    });
    expect(made.assignmentId).toBe(seeded.assignment.id);
  });
});
