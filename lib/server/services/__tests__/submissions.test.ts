import { describe, expect, it } from "vitest";

import { MAX_FILES_PER_RECORD, MAX_UPLOAD_BYTES } from "@/lib/domain/uploads";
import { ApiError } from "@/lib/server/errors";
import {
  listOwnSubmissions,
  submitAssignment,
} from "@/lib/server/services/submissions";
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
const fields = (error: ApiError) => error.details.map((d) => d.field);
const text = (value: string) => new TextEncoder().encode(value);
const file = (name = "essay.txt", body = "my essay") => ({
  filename: name,
  contentType: "text/plain",
  bytes: text(body),
});

describe("submitAssignment", () => {
  it("saves text as attempt 1 and records who did it, by id only", async () => {
    const seeded = await seedAssignment({ students: 2 });
    const ctx = await seeded.school.students[0]!.context();

    const { submission, attachments } = await submitAssignment(
      ctx,
      seeded.assignment.id,
      { text: "My answer", files: [] },
    );

    expect(submission.attemptNumber).toBe(1);
    expect(submission.text).toBe("My answer");
    expect(submission.grade).toBeNull();
    expect(submission.gradedAt).toBeNull();
    expect(submission.student.memberId).toBe(ctx.memberId);
    expect(attachments).toEqual([]);

    const log = await testDb().activityLog.findFirstOrThrow({
      where: { resourceId: submission.id, action: "create" },
    });
    expect(log.actorMemberId).toBe(ctx.memberId);
    expect(JSON.stringify(log.metadata)).not.toContain("My answer");
  });

  it("stores files with the submission", async () => {
    const seeded = await seedAssignment();
    const ctx = await seeded.school.students[0]!.context();

    const { attachments } = await submitAssignment(ctx, seeded.assignment.id, {
      text: null,
      files: [file("a.txt"), file("b.txt", "second")],
    });

    expect(attachments.map((a) => a.filename)).toEqual(["a.txt", "b.txt"]);
  });

  it("lists every content problem at once", async () => {
    const seeded = await seedAssignment();
    const ctx = await seeded.school.students[0]!.context();

    const empty = await failure(
      submitAssignment(ctx, seeded.assignment.id, { text: null, files: [] }),
    );
    expect(empty.status).toBe(422);
    expect(codes(empty)).toEqual(["content_required"]);

    const many = await failure(
      submitAssignment(ctx, seeded.assignment.id, {
        text: null,
        files: [
          ...Array.from({ length: MAX_FILES_PER_RECORD }, () => file()),
          {
            filename: "big.txt",
            contentType: "text/plain",
            bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1).fill(97),
          },
          { ...file("x.exe"), contentType: "application/x-msdownload" },
        ],
      }),
    );
    expect(codes(many)).toEqual([
      "too_many_files",
      "file_too_large",
      "content_type_not_allowed",
    ]);
    expect(fields(many)).toEqual([
      "files",
      `files.${MAX_FILES_PER_RECORD}.file`,
      `files.${MAX_FILES_PER_RECORD + 1}.contentType`,
    ]);
    expect(await testDb().assignmentSubmission.count()).toBe(0);
  });

  it("blocks a second submission by default with 409", async () => {
    const seeded = await seedAssignment();
    const ctx = await seeded.school.students[0]!.context();
    await submitAssignment(ctx, seeded.assignment.id, {
      text: "one",
      files: [],
    });

    const error = await failure(
      submitAssignment(ctx, seeded.assignment.id, { text: "two", files: [] }),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe("submission_limit_reached");
  });

  it("numbers further attempts when the assignment allows them", async () => {
    const seeded = await seedAssignment({ assignment: { maxSubmissions: 2 } });
    const ctx = await seeded.school.students[0]!.context();

    const first = await submitAssignment(ctx, seeded.assignment.id, {
      text: "one",
      files: [],
    });
    const second = await submitAssignment(ctx, seeded.assignment.id, {
      text: "two",
      files: [],
    });

    expect([
      first.submission.attemptNumber,
      second.submission.attemptNumber,
    ]).toEqual([1, 2]);
  });

  it("keeps a failed file from leaving a half-made submission behind", async () => {
    const seeded = await seedAssignment();
    const ctx = await seeded.school.students[0]!.context();

    await failure(
      submitAssignment(ctx, seeded.assignment.id, {
        text: "hello",
        files: [{ ...file(), bytes: new Uint8Array([0xff, 0xfe, 0x00]) }],
      }),
    );

    expect(await testDb().assignmentSubmission.count()).toBe(0);
  });

  it("treats an unpublished assignment as absent", async () => {
    const seeded = await seedAssignment({ assignment: { publishedAt: null } });
    const ctx = await seeded.school.students[0]!.context();

    const error = await failure(
      submitAssignment(ctx, seeded.assignment.id, { text: "x", files: [] }),
    );

    expect(error.status).toBe(404);
  });

  it("refuses a dropped student with 403", async () => {
    const seeded = await seedAssignment();
    const ctx = await seeded.school.students[0]!.context();
    await testDb().classSeat.update({
      where: { id: seeded.seats[0]!.id },
      data: { status: "dropped", droppedAt: new Date() },
    });

    const error = await failure(
      submitAssignment(ctx, seeded.assignment.id, { text: "x", files: [] }),
    );

    expect(error.status).toBe(403);
    expect(error.code).toBe("seat_not_active");
  });

  it("treats a class the student is not in as absent", async () => {
    const seeded = await seedAssignment({ students: 2 });
    const outsider = await seeded.school.students[1]!.context();
    await testDb().classSeat.update({
      where: { id: seeded.seats[1]!.id },
      data: { deletedAt: new Date() },
    });

    const error = await failure(
      submitAssignment(outsider, seeded.assignment.id, {
        text: "x",
        files: [],
      }),
    );

    expect(error.status).toBe(404);
  });

  it("treats an assignment in another school as absent", async () => {
    const mine = await seedAssignment();
    const other = await seedAssignment();
    const ctx = await mine.school.students[0]!.context();

    const error = await failure(
      submitAssignment(ctx, other.assignment.id, { text: "x", files: [] }),
    );

    expect(error.status).toBe(404);
  });

  it("is only for students", async () => {
    const seeded = await seedAssignment();

    for (const persona of [seeded.school.teachers[0]!, seeded.school.admin]) {
      const error = await failure(
        submitAssignment(await persona.context(), seeded.assignment.id, {
          text: "x",
          files: [],
        }),
      );
      expect(error.status).toBe(403);
    }
  });
});

describe("listOwnSubmissions", () => {
  async function manyGraded() {
    const seeded = await seedSubmission({
      students: 2,
      grade: { points: "95" },
      assignment: { title: "Fractions worksheet" },
    });
    const other = await seedAssignment({
      seeded,
      assignment: { title: "Reading log", maxSubmissions: 3 },
    });
    await seedSubmission({
      seededAssignment: other,
      grade: { band: "Incomplete" },
    });
    const third = await seedAssignment({
      seeded,
      assignment: { title: "Fractions quiz" },
    });
    await seedSubmission({ seededAssignment: third });
    return seeded;
  }

  it("shows a student only their own work, newest first", async () => {
    const seeded = await manyGraded();
    const classmate = seeded.seats[1]!;
    const otherAssignment = await seedAssignment({
      seeded,
      assignment: { title: "Classmate only" },
    });
    await testDb().assignmentSubmission.create({
      data: {
        organizationId: seeded.klass.organizationId,
        assignmentId: otherAssignment.assignment.id,
        classSeatId: classmate.id,
        attemptNumber: 1,
      },
    });
    const ctx = await seeded.school.students[0]!.context();

    const page = await listOwnSubmissions(ctx, {});

    expect(page.items.map((s) => s.assignment.title)).toEqual([
      "Fractions quiz",
      "Reading log",
      "Fractions worksheet",
    ]);
    expect(page.nextCursor).toBeNull();
    const graded = page.items[2]!;
    expect(graded.grade).toMatchObject({
      label: "A",
      pointsAwarded: "95.00",
      maxPoints: "100.00",
      percent: "95.00",
    });
  });

  it("filters by grade label, group and ungraded", async () => {
    const seeded = await manyGraded();
    const ctx = await seeded.school.students[0]!.context();
    const titles = async (grade: string) =>
      (await listOwnSubmissions(ctx, { grade })).items.map(
        (s) => s.assignment.title,
      );

    expect(await titles("a")).toEqual(["Fractions worksheet"]);
    expect(await titles("incomplete")).toEqual(["Reading log"]);
    expect(await titles("ungraded")).toEqual(["Fractions quiz"]);
    expect(await titles("B")).toEqual([]);
  });

  it("filters by assignment name, ignoring case", async () => {
    const seeded = await manyGraded();
    const ctx = await seeded.school.students[0]!.context();

    const page = await listOwnSubmissions(ctx, { assignment: "FRACTIONS" });

    expect(page.items.map((s) => s.assignment.title)).toEqual([
      "Fractions quiz",
      "Fractions worksheet",
    ]);
  });

  it("rejects an unknown grade, a bad page size and a bad cursor together", async () => {
    const seeded = await manyGraded();
    const ctx = await seeded.school.students[0]!.context();

    const error = await failure(
      listOwnSubmissions(ctx, { grade: "Z", pageSize: 0, cursor: "nope" }),
    );

    expect(error.status).toBe(422);
    expect(codes(error)).toEqual([
      "unknown_grade",
      "page_size_out_of_range",
      "invalid_cursor",
    ]);
  });

  it("pages with a cursor without skipping or repeating", async () => {
    const seeded = await manyGraded();
    const ctx = await seeded.school.students[0]!.context();

    const first = await listOwnSubmissions(ctx, { pageSize: 2 });
    const second = await listOwnSubmissions(ctx, {
      pageSize: 2,
      cursor: first.nextCursor!,
    });

    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((s) => s.id)).size,
    ).toBe(3);
  });

  it("is only for students", async () => {
    const seeded = await seedAssignment();
    const error = await failure(
      listOwnSubmissions(await seeded.school.teachers[0]!.context(), {}),
    );
    expect(error.status).toBe(403);
  });
});
