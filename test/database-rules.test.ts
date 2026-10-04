import { describe, expect, it } from "vitest";

import { assignmentFactory, gradingScaleFactory } from "./factories/academics";
import { testDb, withRollbackDb } from "./rollback-db";
import { seedAssignment, seedClass, seedSubmission } from "./scenarios/class";

withRollbackDb();

async function expectViolation(promise: Promise<unknown>, constraint: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof Error))
    throw new Error("expected the statement to be rejected");
  expect(error.message).toContain(constraint);
}

describe("tenant integrity (composite foreign keys)", () => {
  it("rejects a class whose term belongs to another school", async () => {
    const a = await seedClass();
    const b = await seedClass();
    await expectViolation(
      testDb().class.create({
        data: {
          organizationId: a.klass.organizationId,
          termId: b.term.id,
          name: "Sneaky",
        },
      }),
      "class_organization_id_term_id_fkey",
    );
  });

  it("rejects a seat for a member of another school", async () => {
    const a = await seedClass();
    const b = await seedClass();
    await expectViolation(
      testDb().classSeat.create({
        data: {
          organizationId: a.klass.organizationId,
          classId: a.klass.id,
          memberId: b.school.students[0]!.member.id,
        },
      }),
      "class_seat_organization_id_member_id_fkey",
    );
  });

  it("rejects a grade band that belongs to a different scale", async () => {
    const { submission, school } = await seedSubmission();
    const other = await gradingScaleFactory
      .passFail()
      .create({ organizationId: school.organization.id });
    const real = await testDb().gradingScale.findFirstOrThrow({
      where: { organizationId: school.organization.id, isDefault: true },
    });

    await expectViolation(
      testDb().assignmentSubmission.update({
        where: { id: submission.id },
        data: {
          gradingScaleId: real.id,
          gradeBandId: other.bands[0]!.id,
          gradeLabel: "Pass",
          gradedAt: new Date(),
          gradedBy: school.teachers[0]!.member.id,
        },
      }),
      "assignment_submission_organization_id_grading_scale_id",
    );
  });
});

describe("check constraints", () => {
  it("require points on points-graded work and forbid them on pass/fail work", async () => {
    const { klass } = await seedClass();
    const base = {
      organizationId: klass.organizationId,
      classId: klass.id,
      title: "Bad",
      type: "homework" as const,
    };
    await expectViolation(
      testDb().assignment.create({
        data: { ...base, gradingMode: "points", maxPoints: null },
      }),
      "assignment_grading_mode",
    );
  });

  it("forbid a maximum on pass/fail work", async () => {
    const { klass } = await seedClass();
    await expectViolation(
      testDb().assignment.create({
        data: {
          organizationId: klass.organizationId,
          classId: klass.id,
          title: "Bad",
          type: "quiz",
          gradingMode: "band",
          maxPoints: "10",
        },
      }),
      "assignment_grading_mode",
    );
  });

  it("require grade columns to be all set or all empty", async () => {
    const { submission } = await seedSubmission();
    await expectViolation(
      testDb().assignmentSubmission.update({
        where: { id: submission.id },
        data: { gradeLabel: "A" },
      }),
      "submission_grade_together",
    );
  });

  it("forbid points without a grade band", async () => {
    const { submission } = await seedSubmission();
    await expectViolation(
      testDb().assignmentSubmission.update({
        where: { id: submission.id },
        data: { pointsAwarded: "5" },
      }),
      "submission_points",
    );
  });

  it("require a drop date exactly when a seat is dropped", async () => {
    const { klass, school } = await seedClass({ students: 0 });
    const extra = await (
      await import("./factories/member")
    ).memberFactory
      .student()
      .create({ organizationId: school.organization.id });
    await expectViolation(
      testDb().classSeat.create({
        data: {
          organizationId: klass.organizationId,
          classId: klass.id,
          memberId: extra.id,
          status: "dropped",
        },
      }),
      "class_seat_dropped",
    );
  });

  it("keep term dates in order", async () => {
    const { year } = await seedClass();
    await expectViolation(
      testDb().term.create({
        data: {
          organizationId: year.organizationId,
          academicYearId: year.id,
          name: "Backwards",
          startsOn: new Date("2026-12-01T00:00:00Z"),
          endsOn: new Date("2026-09-01T00:00:00Z"),
        },
      }),
      "term_dates",
    );
  });
});

describe("uniqueness", () => {
  it("allows one submission per attempt number", async () => {
    const { submission, assignment, seats } = await seedSubmission();
    await expectViolation(
      testDb().assignmentSubmission.create({
        data: {
          organizationId: submission.organizationId,
          assignmentId: assignment.id,
          classSeatId: seats[0]!.id,
          attemptNumber: submission.attemptNumber,
        },
      }),
      "Unique constraint failed",
    );
  });

  it("rejects a second live class with the same name in a term", async () => {
    const { klass } = await seedClass();
    await expectViolation(
      testDb().class.create({
        data: {
          organizationId: klass.organizationId,
          termId: klass.termId,
          name: klass.name,
        },
      }),
      "class_name_live",
    );
  });

  it("lets a soft-deleted class's name be used again", async () => {
    const { klass } = await seedClass();
    await testDb().class.update({
      where: { id: klass.id },
      data: { deletedAt: new Date(), deletionReason: "Duplicate" },
    });
    const again = await testDb().class.create({
      data: {
        organizationId: klass.organizationId,
        termId: klass.termId,
        name: klass.name,
      },
    });
    expect(again.id).not.toBe(klass.id);
  });

  it("allows only one default grading scale per school", async () => {
    const { school } = await seedClass();
    await expectViolation(
      testDb().gradingScale.create({
        data: {
          organizationId: school.organization.id,
          name: "Second default",
          isDefault: true,
        },
      }),
      "grading_scale_one_default",
    );
  });
});

describe("soft deletes", () => {
  it("hide deleted rows from top-level reads but keep them in the table", async () => {
    const { assignment, klass } = await seedAssignment();
    await testDb().assignment.update({
      where: { id: assignment.id },
      data: { deletedAt: new Date(), deletionReason: "Wrong class" },
    });

    expect(
      await testDb().assignment.findMany({ where: { classId: klass.id } }),
    ).toHaveLength(0);
    expect(
      await testDb().assignment.findFirst({ where: { id: assignment.id } }),
    ).toBeNull();
    expect(
      await testDb().assignment.findUnique({ where: { id: assignment.id } }),
    ).toBeNull();
    expect(
      await testDb().assignment.count({ where: { classId: klass.id } }),
    ).toBe(0);

    const raw = await testDb().$queryRaw<
      Array<{ n: bigint }>
    >`SELECT count(*) AS n FROM assignment WHERE id = ${assignment.id}::uuid`;
    expect(Number(raw[0]?.n)).toBe(1);
  });

  it("refuse hard deletes through the client", async () => {
    const { assignment } = await seedAssignment();
    await expect(
      testDb().assignment.delete({ where: { id: assignment.id } }),
    ).rejects.toThrow(/soft-deleted/);
    await expect(
      testDb().class.deleteMany({
        where: { organizationId: assignment.organizationId },
      }),
    ).rejects.toThrow(/soft-deleted/);
  });

  it("do not filter nested includes, so services must", async () => {
    const { assignment, klass } = await seedAssignment();
    await assignmentFactory.deleted().create({ classId: klass.id });

    const withNested = await testDb().class.findFirstOrThrow({
      where: { id: klass.id },
      include: { assignments: true },
    });
    expect(withNested.assignments.length).toBeGreaterThan(1);

    const filtered = await testDb().class.findFirstOrThrow({
      where: { id: klass.id },
      include: { assignments: { where: { deletedAt: null } } },
    });
    expect(filtered.assignments.map((a) => a.id)).toEqual([assignment.id]);
  });
});

describe("file storage", () => {
  async function blobFor(organizationId: string) {
    return testDb().storageBlob.create({
      data: {
        organizationId,
        key: crypto.randomUUID(),
        filename: "essay.txt",
        contentType: "text/plain",
        byteSize: 5,
        checksum: "abc",
        serviceName: "database",
      },
    });
  }

  it("keeps a blob's bytes in a separate row and loads them only on request", async () => {
    const { school } = await seedClass();
    const blob = await blobFor(school.organization.id);
    await testDb().storageBlobData.create({
      data: {
        organizationId: school.organization.id,
        blobId: blob.id,
        content: Buffer.from("hello"),
      },
    });

    const listed = await testDb().storageBlob.findFirstOrThrow({
      where: { id: blob.id },
    });
    expect("content" in listed).toBe(false);
    const data = await testDb().storageBlobData.findFirstOrThrow({
      where: { blobId: blob.id },
    });
    expect(Buffer.from(data.content).toString()).toBe("hello");
  });

  it("allows one data row per blob", async () => {
    const { school } = await seedClass();
    const blob = await blobFor(school.organization.id);
    const data = {
      organizationId: school.organization.id,
      blobId: blob.id,
      content: Buffer.from("x"),
    };
    await testDb().storageBlobData.create({ data });
    await expectViolation(
      testDb().storageBlobData.create({ data }),
      "storage_blob_data_organization_id_blob_id_key",
    );
  });

  it("rejects a negative size", async () => {
    const { school } = await seedClass();
    await expectViolation(
      testDb().storageBlob.create({
        data: {
          organizationId: school.organization.id,
          key: "k",
          filename: "a.txt",
          contentType: "text/plain",
          byteSize: -1,
          checksum: "abc",
          serviceName: "database",
        },
      }),
      "storage_blob_size",
    );
  });

  it("rejects attaching another school's blob", async () => {
    const a = await seedSubmission();
    const b = await seedClass();
    const foreign = await blobFor(b.school.organization.id);
    await expectViolation(
      testDb().storageAttachment.create({
        data: {
          organizationId: a.submission.organizationId,
          blobId: foreign.id,
          recordType: "assignment_submission",
          recordId: a.submission.id,
          name: "files",
        },
      }),
      "storage_attachment_organization_id_blob_id_fkey",
    );
  });

  it("rejects attaching the same blob to the same record twice", async () => {
    const { submission } = await seedSubmission();
    const blob = await blobFor(submission.organizationId);
    const data = {
      organizationId: submission.organizationId,
      blobId: blob.id,
      recordType: "assignment_submission" as const,
      recordId: submission.id,
      name: "files",
    };
    await testDb().storageAttachment.create({ data });
    await expectViolation(
      testDb().storageAttachment.create({ data }),
      "storage_attachment_live",
    );
  });

  it("makes blobs and their bytes immutable for the runtime role", async () => {
    const { school } = await seedClass();
    const blob = await blobFor(school.organization.id);

    await expect(
      testDb().storageBlob.update({
        where: { id: blob.id },
        data: { filename: "x" },
      }),
    ).rejects.toThrow(/append-only/);
    await expect(
      testDb().$executeRaw`UPDATE "storage_blob" SET "filename" = 'x'`,
    ).rejects.toThrow(/permission denied/);
  });

  it("soft-deletes attachments but never the blob", async () => {
    const { submission } = await seedSubmission();
    const blob = await blobFor(submission.organizationId);
    const attachment = await testDb().storageAttachment.create({
      data: {
        organizationId: submission.organizationId,
        blobId: blob.id,
        recordType: "assignment_submission",
        recordId: submission.id,
        name: "files",
      },
    });
    await testDb().storageAttachment.update({
      where: { id: attachment.id },
      data: { deletedAt: new Date(), deletionReason: "Wrong file" },
    });
    expect(
      await testDb().storageAttachment.findFirst({
        where: { id: attachment.id },
      }),
    ).toBeNull();
    expect(
      await testDb().storageBlob.findFirst({ where: { id: blob.id } }),
    ).not.toBeNull();
  });
});
