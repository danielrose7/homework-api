import { describe, expect, it } from "vitest";

import { downloadAttachmentRoute as download } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/attachments/[attachment_id]/route";
import { listAttachmentsRoute as list } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/attachments/route";
import { STATUS } from "@/lib/http-status";
import { submitAssignment } from "@/modules/submissions/mutations/submit-assignment";
import { callRoute } from "@/test/http";
import { seedAssignment } from "@/test/scenarios/class";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

const upload = (filename: string, body: string) => ({
  filename,
  content_type: "text/plain",
  bytes: new TextEncoder().encode(body),
});

async function submittedWithFile(filename = "essay.txt") {
  const seeded = await seedAssignment({ students: 2 });
  const student = await seeded.school.students[0]!.context();
  const { submission, attachments } = await submitAssignment(
    student,
    seeded.assignment.id,
    { text: null, files: [upload(filename, "the real bytes")] },
  );
  return {
    seeded,
    org_slug: seeded.school.organization.slug,
    submission_id: submission.id,
    attachment_id: attachments[0]!.attachment_id,
  };
}

describe("GET /submissions/{id}/attachments", () => {
  it("lists the files for the owner, the teacher and an administrator", async () => {
    const { seeded, org_slug, submission_id, attachment_id } =
      await submittedWithFile();

    for (const persona of [
      seeded.school.students[0]!,
      seeded.school.teachers[0]!,
      seeded.school.admin,
    ]) {
      const response = await callRoute(
        list,
        { org_slug, submission_id },
        { headers: persona.headers },
      );
      expect(response.status).toBe(STATUS.ok);
      expect(await response.json()).toEqual({
        object: "list",
        url: `/api/v1/orgs/${org_slug}/submissions/${submission_id}/attachments`,
        has_more: false,
        data: [
          {
            id: attachment_id,
            object: "attachment",
            filename: "essay.txt",
            content_type: "text/plain",
            byte_size: 14,
            checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
          },
        ],
      });
    }
  });

  it("answers 404 to a classmate and 401 without a token", async () => {
    const { seeded, org_slug, submission_id } = await submittedWithFile();

    const classmate = await callRoute(
      list,
      { org_slug, submission_id },
      { headers: seeded.school.students[1]!.headers },
    );
    const anonymous = await callRoute(list, { org_slug, submission_id });

    expect(classmate.status).toBe(STATUS.not_found);
    expect(anonymous.status).toBe(STATUS.unauthorized);
  });

  it("answers 422 for an id that is not a uuid", async () => {
    const { seeded, org_slug } = await submittedWithFile();

    const response = await callRoute(
      list,
      { org_slug, submission_id: "nope" },
      { headers: seeded.school.admin.headers },
    );

    expect(response.status).toBe(STATUS.unprocessable_content);
  });
});

describe("GET /submissions/{id}/attachments/{attachment_id}", () => {
  it("streams the bytes with safe download headers and logs the read", async () => {
    const { seeded, org_slug, submission_id, attachment_id } =
      await submittedWithFile();

    const response = await callRoute(
      download,
      { org_slug, submission_id, attachment_id },
      { headers: seeded.school.teachers[0]!.headers },
    );

    expect(response.status).toBe(STATUS.ok);
    expect(await response.text()).toBe("the real bytes");
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("content-length")).toBe("14");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="essay.txt"; filename*=UTF-8''essay.txt`,
    );
    expect(
      await testDb().activityLog.count({
        where: { action: "read", resource_id: attachment_id },
      }),
    ).toBe(1);
  });

  it("keeps odd file names from breaking out of the header", async () => {
    const { seeded, org_slug, submission_id, attachment_id } =
      await submittedWithFile(`résumé "final"; v2.txt`);

    const response = await callRoute(
      download,
      { org_slug, submission_id, attachment_id },
      { headers: seeded.school.admin.headers },
    );

    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="r_sum_ _final_; v2.txt"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22final%22%3B%20v2.txt`,
    );
  });

  it("answers 404 to a classmate, for another submission's id, and for a missing file", async () => {
    const { seeded, org_slug, submission_id, attachment_id } =
      await submittedWithFile();
    const missing = "0198f0f0-0000-7000-8000-000000000000";

    const classmate = await callRoute(
      download,
      { org_slug, submission_id, attachment_id },
      { headers: seeded.school.students[1]!.headers },
    );
    const wrongSubmission = await callRoute(
      download,
      { org_slug, submission_id: missing, attachment_id },
      { headers: seeded.school.admin.headers },
    );
    const noFile = await callRoute(
      download,
      { org_slug, submission_id, attachment_id: missing },
      { headers: seeded.school.admin.headers },
    );

    expect(classmate.status).toBe(STATUS.not_found);
    expect(wrongSubmission.status).toBe(STATUS.not_found);
    expect(noFile.status).toBe(STATUS.not_found);
  });
});
