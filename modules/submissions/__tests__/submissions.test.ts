import { describe, expect, it } from "vitest";

import { MAX_FILES_PER_RECORD, MAX_UPLOAD_BYTES } from "@/lib/domain/uploads";
import { STATUS } from "@/lib/http-status";
import { ApiError } from "@/lib/server/errors";
import { listSubmissionsOverview } from "@/modules/submissions/queries/list-submissions-overview";
import { listOwnSubmissions } from "@/modules/submissions/queries/list-own-submissions";
import { submitAssignment } from "@/modules/submissions/mutations/submit-assignment";
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
  content_type: "text/plain",
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

    expect(submission.attempt_number).toBe(1);
    expect(submission.text).toBe("My answer");
    expect(submission.grade).toBeNull();
    expect(submission.graded_at).toBeNull();
    expect(submission.student.member_id).toBe(ctx.member_id);
    expect(attachments).toEqual([]);

    const log = await testDb().activityLog.findFirstOrThrow({
      where: { resource_id: submission.id, action: "create" },
    });
    expect(log.actor_member_id).toBe(ctx.member_id);
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
    expect(empty.status).toBe(STATUS.unprocessable_content);
    expect(codes(empty)).toEqual(["content_required"]);

    const many = await failure(
      submitAssignment(ctx, seeded.assignment.id, {
        text: null,
        files: [
          ...Array.from({ length: MAX_FILES_PER_RECORD }, () => file()),
          {
            filename: "big.txt",
            content_type: "text/plain",
            bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1).fill(97),
          },
          { ...file("x.exe"), content_type: "application/x-msdownload" },
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
      `files.${MAX_FILES_PER_RECORD + 1}.content_type`,
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

    expect(error.status).toBe(STATUS.conflict);
    expect(error.code).toBe("submission_limit_reached");
  });

  it("numbers further attempts when the assignment allows them", async () => {
    const seeded = await seedAssignment({ assignment: { max_submissions: 2 } });
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
      first.submission.attempt_number,
      second.submission.attempt_number,
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
    const seeded = await seedAssignment({ assignment: { published_at: null } });
    const ctx = await seeded.school.students[0]!.context();

    const error = await failure(
      submitAssignment(ctx, seeded.assignment.id, { text: "x", files: [] }),
    );

    expect(error.status).toBe(STATUS.not_found);
  });

  it("refuses a dropped student with 403", async () => {
    const seeded = await seedAssignment();
    const ctx = await seeded.school.students[0]!.context();
    await testDb().classSeat.update({
      where: { id: seeded.seats[0]!.id },
      data: { status: "dropped", dropped_at: new Date() },
    });

    const error = await failure(
      submitAssignment(ctx, seeded.assignment.id, { text: "x", files: [] }),
    );

    expect(error.status).toBe(STATUS.forbidden);
    expect(error.code).toBe("seat_not_active");
  });

  it("treats a class the student is not in as absent", async () => {
    const seeded = await seedAssignment({ students: 2 });
    const outsider = await seeded.school.students[1]!.context();
    await testDb().classSeat.update({
      where: { id: seeded.seats[1]!.id },
      data: { deleted_at: new Date() },
    });

    const error = await failure(
      submitAssignment(outsider, seeded.assignment.id, {
        text: "x",
        files: [],
      }),
    );

    expect(error.status).toBe(STATUS.not_found);
  });

  it("treats an assignment in another school as absent", async () => {
    const mine = await seedAssignment();
    const other = await seedAssignment();
    const ctx = await mine.school.students[0]!.context();

    const error = await failure(
      submitAssignment(ctx, other.assignment.id, { text: "x", files: [] }),
    );

    expect(error.status).toBe(STATUS.not_found);
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
      expect(error.status).toBe(STATUS.forbidden);
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
      assignment: { title: "Reading log", max_submissions: 3 },
    });
    await seedSubmission({
      seeded_assignment: other,
      grade: { band: "Incomplete" },
    });
    const third = await seedAssignment({
      seeded,
      assignment: { title: "Fractions quiz" },
    });
    await seedSubmission({ seeded_assignment: third });
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
        organization_id: seeded.klass.organization_id,
        assignment_id: otherAssignment.assignment.id,
        class_seat_id: classmate.id,
        attempt_number: 1,
      },
    });
    const ctx = await seeded.school.students[0]!.context();

    const page = await listOwnSubmissions(ctx, {});

    expect(page.items.map((s) => s.assignment.title)).toEqual([
      "Fractions quiz",
      "Reading log",
      "Fractions worksheet",
    ]);
    expect(page.has_more).toBe(false);
    const graded = page.items[2]!;
    expect(graded.grade).toMatchObject({
      label: "A",
      points_awarded: "95.00",
      max_points: "100.00",
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

  it("rejects an unknown grade, a bad limit and a bad starting_after together", async () => {
    const seeded = await manyGraded();
    const ctx = await seeded.school.students[0]!.context();

    const error = await failure(
      listOwnSubmissions(ctx, {
        grade: "Z",
        limit: 0,
        starting_after: crypto.randomUUID(),
      }),
    );

    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(codes(error)).toEqual([
      "unknown_grade",
      "limit_out_of_range",
      "unknown_starting_after",
    ]);
  });

  it("pages with starting_after without skipping or repeating", async () => {
    const seeded = await manyGraded();
    const ctx = await seeded.school.students[0]!.context();

    const first = await listOwnSubmissions(ctx, { limit: 2 });
    const second = await listOwnSubmissions(ctx, {
      limit: 2,
      starting_after: first.items.at(-1)!.id,
    });

    expect(first.items).toHaveLength(2);
    expect(first.has_more).toBe(true);
    expect(second.items).toHaveLength(1);
    expect(second.has_more).toBe(false);
    expect(
      new Set([...first.items, ...second.items].map((s) => s.id)).size,
    ).toBe(3);
  });

  it("is only for students", async () => {
    const seeded = await seedAssignment();
    const error = await failure(
      listOwnSubmissions(await seeded.school.teachers[0]!.context(), {}),
    );
    expect(error.status).toBe(STATUS.forbidden);
  });
});

describe("listSubmissionsOverview", () => {
  async function twoClasses() {
    const first = await seedSubmission({
      students: 2,
      teachers: 2,
      assignment: { title: "Fractions" },
    });
    const second = await seedAssignment({
      school: first.school,
      assignment: { title: "Poetry" },
    });
    await testDb().classTeacher.updateMany({
      where: {
        class_id: second.klass.id,
        member_id: first.school.teachers[0]!.member.id,
      },
      data: { deleted_at: new Date() },
    });
    const poems = await seedSubmission({ seeded_assignment: second });
    return { first, second, poems };
  }

  it("shows a teacher only the classes they teach and an administrator everything", async () => {
    const { first } = await twoClasses();
    await seedSubmission();
    const titles = async (persona: (typeof first.school)["admin"]) =>
      (await listSubmissionsOverview(await persona.context(), {})).items
        .map((s) => s.assignment.title)
        .sort();

    expect(await titles(first.school.teachers[0]!)).toEqual(["Fractions"]);
    expect(await titles(first.school.teachers[1]!)).toEqual([
      "Fractions",
      "Poetry",
    ]);
    expect(await titles(first.school.admin)).toEqual(["Fractions", "Poetry"]);
  });

  it("is not for students", async () => {
    const { first } = await twoClasses();

    const error = await failure(
      listSubmissionsOverview(await first.school.students[0]!.context(), {}),
    );

    expect(error.status).toBe(STATUS.forbidden);
  });

  it("filters by student display name or username, ignoring case", async () => {
    const { first } = await twoClasses();
    const [maya, sam] = first.school.students;
    await testDb().user.update({
      where: { id: maya!.member.user.id },
      data: { name: "Maya Chen", username: "mchen" },
    });
    await testDb().user.update({
      where: { id: sam!.member.user.id },
      data: { name: "Sam Ortiz", username: "sortiz" },
    });
    const secondSubmission = await seedAssignment({
      seeded: first,
      assignment: { title: "Sam's work" },
    });
    await testDb().assignmentSubmission.create({
      data: {
        organization_id: first.klass.organization_id,
        assignment_id: secondSubmission.assignment.id,
        class_seat_id: first.seats[1]!.id,
        attempt_number: 1,
      },
    });
    const ctx = await first.school.admin.context();
    const names = async (student: string) =>
      (await listSubmissionsOverview(ctx, { student })).items.map(
        (s) => s.student.name,
      );

    expect(await names("chen")).toEqual(["Maya Chen", "Maya Chen"]);
    expect(await names("MAYA")).toEqual(["Maya Chen", "Maya Chen"]);
    expect(await names("sortiz")).toEqual(["Sam Ortiz"]);
    expect(await names("zz")).toEqual([]);
  });

  describe("date range", () => {
    async function submitted_at(...instants: string[]) {
      const seeded = await seedSubmission();
      const rows = [seeded.submission.id];
      for (const [index] of instants.slice(1).entries()) {
        const next = await seedAssignment({
          seeded,
          assignment: { title: `Extra ${index}` },
        });
        const made = await seedSubmission({ seeded_assignment: next });
        rows.push(made.submission.id);
      }
      for (const [index, id] of rows.entries()) {
        await testDb().assignmentSubmission.update({
          where: { id },
          data: { submitted_at: new Date(instants[index]!) },
        });
      }
      return { seeded, ctx: await seeded.school.admin.context(), rows };
    }

    it("reads from and to as days in the school's time zone, both inclusive", async () => {
      const { ctx, rows } = await submitted_at(
        "2026-03-10T03:30:00Z",
        "2026-03-10T04:00:00Z",
        "2026-03-11T03:59:59Z",
        "2026-03-11T04:00:00Z",
      );
      const ids = async (range: { from?: string; to?: string }) =>
        (await listSubmissionsOverview(ctx, range)).items
          .map((s) => rows.indexOf(s.id))
          .sort();

      expect(await ids({ to: "2026-03-09" })).toEqual([0]);
      expect(await ids({ from: "2026-03-10", to: "2026-03-10" })).toEqual([
        1, 2,
      ]);
      expect(await ids({ from: "2026-03-10" })).toEqual([1, 2, 3]);
      expect(await ids({ from: "2026-03-09", to: "2026-03-11" })).toEqual([
        0, 1, 2, 3,
      ]);
    });

    it("moves the day boundaries when the school changes its time zone", async () => {
      const { seeded, ctx } = await submitted_at("2026-03-10T03:30:00Z");
      await testDb().organizationPreferences.update({
        where: { organization_id: seeded.school.organization.id },
        data: { timezone: "Asia/Tokyo" },
      });

      const items = (range: { from: string; to: string }) =>
        listSubmissionsOverview(ctx, range).then((page) => page.items);

      expect(
        await items({ from: "2026-03-10", to: "2026-03-10" }),
      ).toHaveLength(1);
      expect(
        await items({ from: "2026-03-09", to: "2026-03-09" }),
      ).toHaveLength(0);
    });
  });

  it("lists every problem at once", async () => {
    const { first } = await twoClasses();
    const ctx = await first.school.admin.context();

    const error = await failure(
      listSubmissionsOverview(ctx, {
        from: "2026-02-01",
        to: "2026-01-01",
        student: "m",
        grade: "Z",
      }),
    );

    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(codes(error)).toEqual([
      "date_range_inverted",
      "student_too_short",
      "unknown_grade",
    ]);
  });
});
