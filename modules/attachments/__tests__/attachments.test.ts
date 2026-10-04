import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { MAX_FILES_PER_RECORD, MAX_UPLOAD_BYTES } from "@/lib/domain/uploads";
import { STATUS } from "@/lib/http-status";
import { ApiError } from "@/lib/server/errors";
import { attachBlobToSubmission } from "@/modules/attachments/mutations/attach-blob-to-submission";
import { createBlob } from "@/modules/attachments/mutations/create-blob";
import { downloadAttachment } from "@/modules/attachments/queries/download-attachment";
import { listSubmissionAttachments } from "@/modules/attachments/queries/list-submission-attachments";
import {
  seedAssignment,
  seedClass,
  seedSubmission,
} from "@/test/scenarios/class";
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
const text = (value: string) => new TextEncoder().encode(value);
const file = (name = "essay.txt", body = "my essay") => ({
  filename: name,
  content_type: "text/plain",
  bytes: text(body),
});

async function submitted(options: Parameters<typeof seedSubmission>[0] = {}) {
  const seeded = await seedSubmission({ students: 2, ...options });
  const student = await seeded.school.students[0]!.context();
  return { seeded, student, id: seeded.submission.id };
}

describe("createBlob", () => {
  it("stores metadata and bytes separately with a checksum", async () => {
    const { student } = await submitted();
    const blob = await createBlob(student, file("essay.txt", "hello"));

    expect(blob).toMatchObject({
      filename: "essay.txt",
      content_type: "text/plain",
      byte_size: 5,
    });
    expect(blob.checksum).toBe(
      createHash("sha256").update("hello").digest("hex"),
    );

    const row = await testDb().storageBlob.findUniqueOrThrow({
      where: { id: blob.id },
    });
    expect(row).toMatchObject({
      service_name: "database",
      uploaded_by_id: student.member_id,
    });
    expect(row.key).toBeTruthy();
    const data = await testDb().storageBlobData.findFirstOrThrow({
      where: { blob_id: blob.id },
    });
    expect(Buffer.from(data.content).toString()).toBe("hello");
  });

  it("sanitizes the file name and records the upload without its contents", async () => {
    const { student } = await submitted();
    const blob = await createBlob(student, file("../../secret/essay.txt"));
    expect(blob.filename).toBe("essay.txt");

    const log = await testDb().activityLog.findFirstOrThrow({
      where: { resource_type: "attachment", action: "create" },
    });
    expect(log.metadata).toEqual({ byte_size: 8 });
  });

  it("rejects bad uploads with every problem listed", async () => {
    const { student } = await submitted();
    const mislabelled = await failure(
      createBlob(student, {
        filename: "x.pdf",
        content_type: "application/pdf",
        bytes: text("nope"),
      }),
    );
    expect(mislabelled.status).toBe(STATUS.unprocessable_content);
    expect(codes(mislabelled)).toEqual(["content_type_mismatch"]);

    const tooBig = await failure(
      createBlob(student, {
        ...file(),
        bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1).fill(97),
      }),
    );
    expect(codes(tooBig)).toEqual(["file_too_large"]);
    expect(await testDb().storageBlob.count()).toBe(0);
  });
});

describe("attachBlobToSubmission", () => {
  it("attaches a blob to the student's own submission and lists it", async () => {
    const { student, id } = await submitted();
    const blob = await createBlob(student, file());

    const attached = await attachBlobToSubmission(student, {
      submission_id: id,
      blob_id: blob.id,
    });
    expect(attached.name).toBe("files");

    const listed = await listSubmissionAttachments(student, id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ filename: "essay.txt", byte_size: 8 });
    expect(listed[0]).not.toHaveProperty("bytes");
  });

  it("refuses another student's submission, teachers, and graded work", async () => {
    const { seeded, student, id } = await submitted();
    const blob = await createBlob(student, file());

    const classmate = await seeded.school.students[1]!.context();
    const otherBlob = await createBlob(classmate, file("other.txt"));
    expect(
      (
        await failure(
          attachBlobToSubmission(classmate, {
            submission_id: id,
            blob_id: otherBlob.id,
          }),
        )
      ).status,
    ).toBe(STATUS.not_found);

    const teacher = await seeded.school.teachers[0]!.context();
    expect(
      (
        await failure(
          attachBlobToSubmission(teacher, {
            submission_id: id,
            blob_id: blob.id,
          }),
        )
      ).status,
    ).toBe(STATUS.forbidden);

    const graded = await submitted({ grade: { points: "90" } });
    const gradedStudent = await graded.seeded.school.students[0]!.context();
    const gradedBlob = await createBlob(gradedStudent, file());
    const error = await failure(
      attachBlobToSubmission(gradedStudent, {
        submission_id: graded.id,
        blob_id: gradedBlob.id,
      }),
    );
    expect(error).toMatchObject({
      status: STATUS.conflict,
      code: "submission_graded",
    });
  });

  it("treats a file from another school like a missing one", async () => {
    const { student, id } = await submitted();
    const other = await seedClass();
    const foreignStudent = await other.school.students[0]!.context();
    const foreign = await createBlob(foreignStudent, file("theirs.txt"));

    const error = await failure(
      attachBlobToSubmission(student, {
        submission_id: id,
        blob_id: foreign.id,
      }),
    );
    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(error.details[0]).toMatchObject({
      field: "blob_id",
      code: "not_found",
    });
  });

  it("limits how many files a submission can hold and rejects duplicates", async () => {
    const { student, id } = await submitted();
    const first = await createBlob(student, file("one.txt"));
    await attachBlobToSubmission(student, {
      submission_id: id,
      blob_id: first.id,
    });
    expect(
      (
        await failure(
          attachBlobToSubmission(student, {
            submission_id: id,
            blob_id: first.id,
          }),
        )
      ).status,
    ).toBe(STATUS.conflict);

    for (let i = 2; i <= MAX_FILES_PER_RECORD; i++) {
      const blob = await createBlob(student, file(`f${i}.txt`, `body ${i}`));
      await attachBlobToSubmission(student, {
        submission_id: id,
        blob_id: blob.id,
      });
    }
    const extra = await createBlob(student, file("extra.txt", "extra"));
    const error = await failure(
      attachBlobToSubmission(student, { submission_id: id, blob_id: extra.id }),
    );
    expect(codes(error)).toEqual(["too_many_files"]);
  });
});

describe("downloadAttachment", () => {
  async function withAttachment() {
    const ctx = await submitted();
    const blob = await createBlob(
      ctx.student,
      file("essay.txt", "the real bytes"),
    );
    const attachment = await attachBlobToSubmission(ctx.student, {
      submission_id: ctx.id,
      blob_id: blob.id,
    });
    return { ...ctx, blob, attachment_id: attachment.id };
  }

  it("returns the bytes to the owner, the class teacher and an administrator", async () => {
    const { seeded, student, attachment_id, id } = await withAttachment();
    const teacher = await seeded.school.teachers[0]!.context();
    const admin = await seeded.school.admin.context();

    for (const ctx of [student, teacher, admin]) {
      const result = await downloadAttachment(ctx, id, attachment_id);
      expect(Buffer.from(result.bytes).toString()).toBe("the real bytes");
      expect(result).toMatchObject({
        filename: "essay.txt",
        content_type: "text/plain",
      });
    }
  });

  it("logs each read with ids only", async () => {
    const { student, attachment_id, id } = await withAttachment();
    await downloadAttachment(student, id, attachment_id);

    const log = await testDb().activityLog.findFirstOrThrow({
      where: { action: "read", resource_type: "attachment" },
    });
    expect(log).toMatchObject({
      resource_id: attachment_id,
      actor_role: "student",
    });
    expect(log.metadata).toEqual({ submission_id: id });
  });

  it("hides the file from a classmate and from another school", async () => {
    const { seeded, attachment_id, id } = await withAttachment();
    const classmate = await seeded.school.students[1]!.context();
    expect(
      (await failure(downloadAttachment(classmate, id, attachment_id))).status,
    ).toBe(STATUS.not_found);

    const other = await seedClass();
    const foreignTeacher = await other.school.teachers[0]!.context();
    expect(
      (await failure(downloadAttachment(foreignTeacher, id, attachment_id)))
        .status,
    ).toBe(STATUS.not_found);
  });

  it("does not serve an attachment under a different submission", async () => {
    const { seeded, student, attachment_id } = await withAttachment();
    const second = await seedAssignment({ seeded });
    const other = await seedSubmission({ seeded_assignment: second });

    expect(
      (
        await failure(
          downloadAttachment(student, other.submission.id, attachment_id),
        )
      ).status,
    ).toBe(STATUS.not_found);
  });

  it("does not serve a detached file", async () => {
    const { student, attachment_id, id } = await withAttachment();
    await testDb().storageAttachment.update({
      where: { id: attachment_id },
      data: { deleted_at: new Date(), deletion_reason: "Wrong file" },
    });
    expect(
      (await failure(downloadAttachment(student, id, attachment_id))).status,
    ).toBe(STATUS.not_found);
  });
});
