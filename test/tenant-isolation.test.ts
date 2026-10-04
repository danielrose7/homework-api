import { describe, expect, it } from "vitest";

import { submitRoute } from "@/app/api/v1/orgs/[org_slug]/assignments/[assignment_id]/submissions/route";
import { downloadAttachmentRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/attachments/[attachment_id]/route";
import { listAttachmentsRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/attachments/route";
import { gradeSubmissionRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/grade/route";
import { getSubmissionRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/route";
import { listOwnRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/me/route";
import { listSubmissionsRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/route";
import { STATUS } from "@/lib/http-status";
import { submitAssignment } from "@/modules/submissions/mutations/submit-assignment";
import { callRoute } from "@/test/http";
import { testDb, withRollbackDb } from "@/test/rollback-db";
import { seedAssignment, seedSubmission } from "@/test/scenarios/class";
import type { Persona } from "@/test/scenarios/school";

withRollbackDb();

type Json = Record<string, unknown>;

async function twoSchools() {
  const a = await seedSubmission({ assignment: { max_points: "100" } });
  const b = await seedAssignment({ assignment: { max_points: "100" } });
  const { submission, attachments } = await submitAssignment(
    await b.school.students[0]!.context(),
    b.assignment.id,
    {
      text: "school B's work",
      files: [
        {
          filename: "b.txt",
          content_type: "text/plain",
          bytes: new TextEncoder().encode("b's bytes"),
        },
      ],
    },
  );
  return {
    a,
    b,
    a_slug: a.school.organization.slug,
    b_slug: b.school.organization.slug,
    b_submission_id: submission.id,
    b_attachment_id: attachments[0]!.attachment_id,
  };
}

const ROLES_FOR: Record<string, readonly string[]> = {
  submit: ["student"],
  grade: ["administrator", "teacher"],
};

async function expectAbsent(response: Response) {
  expect(response.status).toBe(STATUS.not_found);
  const body = (await response.json()) as { error: { code: string } };
  expect(body.error.code).toBe("not_found");
}

const members = (school: {
  admin: Persona;
  teachers: Persona[];
  students: Persona[];
}) =>
  [
    ["administrator", school.admin],
    ["teacher", school.teachers[0]!],
    ["student", school.students[0]!],
  ] as const;

describe("tenant isolation", () => {
  it("answers 404 for another school's records, whatever the caller's role", async () => {
    const t = await twoSchools();

    for (const [role, persona] of members(t.a.school)) {
      const as = { headers: persona.headers };
      const inA = (path: Record<string, string>) => ({
        org_slug: t.a_slug,
        ...path,
      });

      const attempts = {
        get: await callRoute(
          getSubmissionRoute,
          inA({ submission_id: t.b_submission_id }),
          as,
        ),
        attachments: await callRoute(
          listAttachmentsRoute,
          inA({ submission_id: t.b_submission_id }),
          as,
        ),
        download: await callRoute(
          downloadAttachmentRoute,
          inA({
            submission_id: t.b_submission_id,
            attachment_id: t.b_attachment_id,
          }),
          as,
        ),
        grade: await callRoute(
          gradeSubmissionRoute,
          inA({ submission_id: t.b_submission_id }),
          {
            ...as,
            method: "PUT",
            json: { points: 90 },
          },
        ),
        submit: await callRoute(
          submitRoute,
          inA({ assignment_id: t.b.assignment.id }),
          {
            ...as,
            json: { text: "sneaky" },
          },
        ),
      };
      for (const [route, response] of Object.entries(attempts)) {
        // The role check runs before any lookup, so a 403 for the wrong role says nothing about school B.
        const allowed = ROLES_FOR[route];
        if (allowed && !allowed.includes(role)) {
          expect(response.status, `${role} ${route}`).toBe(STATUS.forbidden);
          continue;
        }
        expect(response.status, `${role} ${route}`).toBe(STATUS.not_found);
        await expectAbsent(response);
      }
    }

    const untouched = await testDb().assignmentSubmission.findMany({
      where: { assignment_id: t.b.assignment.id },
    });
    expect(untouched).toHaveLength(1);
    expect(untouched[0]!.graded_at).toBeNull();
  });

  it("answers 404 when a school's own slug is used with another school's credentials", async () => {
    const t = await twoSchools();

    for (const [, persona] of members(t.a.school)) {
      const as = { headers: persona.headers };
      const inB = { org_slug: t.b_slug };

      await expectAbsent(await callRoute(listSubmissionsRoute, inB, as));
      await expectAbsent(await callRoute(listOwnRoute, inB, as));
      await expectAbsent(
        await callRoute(
          getSubmissionRoute,
          { ...inB, submission_id: t.b_submission_id },
          as,
        ),
      );
      await expectAbsent(
        await callRoute(
          submitRoute,
          { ...inB, assignment_id: t.b.assignment.id },
          { ...as, json: { text: "x" } },
        ),
      );
    }
  });

  it("keeps lists to the caller's own school", async () => {
    const t = await twoSchools();

    for (const [, persona] of [
      members(t.a.school)[0]!,
      members(t.a.school)[2]!,
    ]) {
      const route =
        persona === t.a.school.admin ? listSubmissionsRoute : listOwnRoute;
      const response = await callRoute(
        route,
        { org_slug: t.a_slug },
        { headers: persona.headers },
      );
      const body = (await response.json()) as { data: Json[] };

      expect(response.status).toBe(STATUS.ok);
      expect(body.data.map((row) => row.id)).toEqual([t.a.submission.id]);
    }
  });

  it("answers 404 for a school's records under the other school's slug, even for that school's own staff", async () => {
    const t = await twoSchools();

    const response = await callRoute(
      getSubmissionRoute,
      { org_slug: t.b_slug, submission_id: t.a.submission.id },
      { headers: t.b.school.admin.headers },
    );

    await expectAbsent(response);
  });
});
