import { describe, expect, it } from "vitest";
import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { listAll, listMine, submit } from "@/lib/server/routes/submissions";
import { callRoute } from "@/test/http";
import { seedAssignment, seedSubmission } from "@/test/scenarios/class";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

type Json = Record<string, unknown>;
const json = async (response: Response) => (await response.json()) as Json;
const errorOf = async (response: Response) =>
  (await json(response)).error as {
    code: string;
    details?: { field: string; code: string }[];
  };

describe("POST /assignments/{id}/submissions", () => {
  it("accepts JSON text and answers 201 with a Location", async () => {
    const seeded = await seedAssignment();
    const student = seeded.school.students[0]!;

    const response = await callRoute(
      submit,
      {
        orgSlug: seeded.school.organization.slug,
        assignmentId: seeded.assignment.id,
      },
      { headers: student.headers, json: { text: "  My answer  " } },
    );

    expect(response.status).toBe(STATUS.created);
    const body = await json(response);
    expect(body).toMatchObject({
      text: "My answer",
      attempt_number: 1,
      grade: null,
      graded_at: null,
      teacher_notes: null,
      attachments: [],
    });
    expect(response.headers.get("location")).toBe(
      `/api/v1/orgs/${seeded.school.organization.slug}/submissions/${body.id}`,
    );
  });

  it("accepts multipart with text and repeated files", async () => {
    const seeded = await seedAssignment();
    const form = new FormData();
    form.set("text", "see attached");
    form.append(
      "files",
      new File(["first"], "a.txt", { type: "text/plain; charset=utf-8" }),
    );
    form.append("files", new File(["second"], "b.txt", { type: "text/plain" }));

    const response = await callRoute(
      submit,
      {
        orgSlug: seeded.school.organization.slug,
        assignmentId: seeded.assignment.id,
      },
      { headers: seeded.school.students[0]!.headers, form },
    );

    expect(response.status).toBe(STATUS.created);
    const body = await json(response);
    expect(body.text).toBe("see attached");
    expect(body.attachments).toMatchObject([
      { filename: "a.txt", content_type: "text/plain", byte_size: 5 },
      { filename: "b.txt", content_type: "text/plain", byte_size: 6 },
    ]);
  });

  it("answers 422 with every issue for bad content", async () => {
    const seeded = await seedAssignment();
    const form = new FormData();
    form.append("files", new File([""], "empty.txt", { type: "text/plain" }));
    form.append(
      "files",
      new File(["x"], "x.exe", { type: "application/x-msdownload" }),
    );

    const response = await callRoute(
      submit,
      {
        orgSlug: seeded.school.organization.slug,
        assignmentId: seeded.assignment.id,
      },
      { headers: seeded.school.students[0]!.headers, form },
    );

    expect(response.status).toBe(STATUS.unprocessable_content);
    const error = await errorOf(response);
    expect(error.details).toEqual([
      expect.objectContaining({ field: "files.0.file", code: "file_empty" }),
      expect.objectContaining({
        field: "files.1.content_type",
        code: "content_type_not_allowed",
      }),
    ]);
  });

  it("answers 422 for a missing text, an unknown field and a non-uuid id", async () => {
    const seeded = await seedAssignment();
    const headers = seeded.school.students[0]!.headers;
    const send = (assignmentId: string, body: unknown) =>
      callRoute(
        submit,
        { orgSlug: seeded.school.organization.slug, assignmentId },
        { headers, json: body },
      );

    expect((await send(seeded.assignment.id, {})).status).toBe(
      STATUS.unprocessable_content,
    );
    expect(
      (await send(seeded.assignment.id, { text: "x", extra: 1 })).status,
    ).toBe(STATUS.unprocessable_content);
    expect((await send("not-a-uuid", { text: "x" })).status).toBe(
      STATUS.unprocessable_content,
    );
  });

  it("answers 400 for malformed JSON", async () => {
    const seeded = await seedAssignment();

    const response = await callRoute(
      submit,
      {
        orgSlug: seeded.school.organization.slug,
        assignmentId: seeded.assignment.id,
      },
      { headers: seeded.school.students[0]!.headers, raw: "{nope" },
    );

    expect(response.status).toBe(STATUS.bad_request);
    expect((await errorOf(response)).code).toBe("invalid_json");
  });

  it("answers 409 on a second submission and 403 for a teacher", async () => {
    const seeded = await seedAssignment();
    const params = {
      orgSlug: seeded.school.organization.slug,
      assignmentId: seeded.assignment.id,
    };
    const headers = seeded.school.students[0]!.headers;
    await callRoute(submit, params, { headers, json: { text: "one" } });

    const again = await callRoute(submit, params, {
      headers,
      json: { text: "two" },
    });
    const teacher = await callRoute(submit, params, {
      headers: seeded.school.teachers[0]!.headers,
      json: { text: "no" },
    });

    expect(again.status).toBe(STATUS.conflict);
    expect((await errorOf(again)).code).toBe("submission_limit_reached");
    expect(teacher.status).toBe(STATUS.forbidden);
  });

  it("answers 401 without a token", async () => {
    const seeded = await seedAssignment();

    const response = await callRoute(
      submit,
      {
        orgSlug: seeded.school.organization.slug,
        assignmentId: seeded.assignment.id,
      },
      { json: { text: "x" } },
    );

    expect(response.status).toBe(STATUS.unauthorized);
  });
});

describe("GET /submissions/me", () => {
  it("returns a page with snake_case fields and a cursor", async () => {
    const seeded = await seedSubmission({
      grade: { points: "92" },
      notes: "Nice work",
    });
    const params = { orgSlug: seeded.school.organization.slug };
    const headers = seeded.school.students[0]!.headers;

    const response = await callRoute(listMine, params, { headers });

    expect(response.status).toBe(STATUS.ok);
    const body = await json(response);
    expect(body.next_cursor).toBeNull();
    expect(body.data).toEqual([
      expect.objectContaining({
        id: seeded.submission.id,
        attempt_number: 1,
        teacher_notes: "Nice work",
        grade: expect.objectContaining({
          label: "A",
          points_awarded: "92.00",
          max_points: "100.00",
          percent: "92.00",
        }),
      }),
    ]);
  });

  it("writes timestamps as ISO 8601 UTC", async () => {
    const seeded = await seedSubmission({ grade: { points: "92" } });

    const response = await callRoute(
      listMine,
      { orgSlug: seeded.school.organization.slug },
      { headers: seeded.school.students[0]!.headers },
    );

    const [row] = (await json(response)).data as Json[];
    for (const field of ["submitted_at", "graded_at"]) {
      expect(z.iso.datetime().safeParse(row?.[field]).success).toBe(true);
      expect(row?.[field]).toMatch(/\.\d{3}Z$/);
    }
  });

  it("applies grade and assignment filters from the query string", async () => {
    const seeded = await seedSubmission({
      grade: { points: "92" },
      assignment: { title: "Fractions" },
    });
    const params = { orgSlug: seeded.school.organization.slug };
    const headers = seeded.school.students[0]!.headers;
    const count = async (query: Record<string, string>) =>
      (
        (await json(await callRoute(listMine, params, { headers, query })))
          .data as unknown[]
      ).length;

    expect(await count({ grade: "A", assignment: "frac" })).toBe(1);
    expect(await count({ grade: "ungraded" })).toBe(0);
    expect(await count({ assignment: "algebra" })).toBe(0);
  });

  it("answers 422 for unknown query parameters and bad values, listing each", async () => {
    const seeded = await seedSubmission();
    const params = { orgSlug: seeded.school.organization.slug };
    const headers = seeded.school.students[0]!.headers;

    const response = await callRoute(listMine, params, {
      headers,
      query: { page_size: "500", color: "red", grade: "Z" },
    });

    expect(response.status).toBe(STATUS.unprocessable_content);
    const fields = (await errorOf(response)).details?.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["page_size", ""]));
  });

  it("answers 422 for a grade the school does not use", async () => {
    const seeded = await seedSubmission();

    const response = await callRoute(
      listMine,
      { orgSlug: seeded.school.organization.slug },
      { headers: seeded.school.students[0]!.headers, query: { grade: "Z" } },
    );

    expect(response.status).toBe(STATUS.unprocessable_content);
    expect((await errorOf(response)).details?.[0]?.code).toBe("unknown_grade");
  });

  it("answers 403 for a teacher", async () => {
    const seeded = await seedSubmission();

    const response = await callRoute(
      listMine,
      { orgSlug: seeded.school.organization.slug },
      { headers: seeded.school.teachers[0]!.headers },
    );

    expect(response.status).toBe(STATUS.forbidden);
  });
});

describe("GET /submissions", () => {
  it("gives a teacher the overview of their classes with the date filter in school time", async () => {
    const seeded = await seedSubmission({ assignment: { title: "Fractions" } });
    await testDb().assignmentSubmission.update({
      where: { id: seeded.submission.id },
      data: { submittedAt: new Date("2026-03-10T03:30:00Z") },
    });
    const params = { orgSlug: seeded.school.organization.slug };
    const headers = seeded.school.teachers[0]!.headers;
    const count = async (query: Record<string, string>) => {
      const response = await callRoute(listAll, params, { headers, query });
      expect(response.status).toBe(STATUS.ok);
      return ((await json(response)).data as unknown[]).length;
    };

    expect(await count({ to: "2026-03-09" })).toBe(1);
    expect(await count({ from: "2026-03-10" })).toBe(0);
    expect(await count({ assignment: "fract", student: "user" })).toBe(1);
  });

  it("answers 422 listing a bad date, an inverted range and a short name", async () => {
    const seeded = await seedSubmission();

    const response = await callRoute(
      listAll,
      { orgSlug: seeded.school.organization.slug },
      {
        headers: seeded.school.admin.headers,
        query: { from: "03/10/2026", student: "m" },
      },
    );
    const inverted = await callRoute(
      listAll,
      { orgSlug: seeded.school.organization.slug },
      {
        headers: seeded.school.admin.headers,
        query: { from: "2026-02-01", to: "2026-01-01" },
      },
    );

    expect(response.status).toBe(STATUS.unprocessable_content);
    expect(
      (await errorOf(response)).details?.map((d) => d.field).sort(),
    ).toEqual(["from", "student"]);
    for (const from of [
      "2026-02-30",
      "2026-3-10",
      "20260310",
      "2026-03-10T00:00:00Z",
    ]) {
      const bad = await callRoute(
        listAll,
        { orgSlug: seeded.school.organization.slug },
        { headers: seeded.school.admin.headers, query: { from } },
      );
      expect(bad.status).toBe(STATUS.unprocessable_content);
    }
    expect(inverted.status).toBe(STATUS.unprocessable_content);
    expect((await errorOf(inverted)).details?.[0]?.code).toBe(
      "date_range_inverted",
    );
  });

  it("answers 403 for a student and 401 without a token", async () => {
    const seeded = await seedSubmission();
    const params = { orgSlug: seeded.school.organization.slug };

    const student = await callRoute(listAll, params, {
      headers: seeded.school.students[0]!.headers,
    });
    const anonymous = await callRoute(listAll, params);

    expect(student.status).toBe(STATUS.forbidden);
    expect(anonymous.status).toBe(STATUS.unauthorized);
  });
});

describe("paging over HTTP", () => {
  async function threeSubmissions() {
    const first = await seedSubmission();
    for (const title of ["Second", "Third"]) {
      const next = await seedAssignment({
        seeded: first,
        assignment: { title },
      });
      await seedSubmission({ seededAssignment: next });
    }
    return first;
  }

  it("walks every submission once by following next_cursor", async () => {
    const seeded = await threeSubmissions();
    const params = { orgSlug: seeded.school.organization.slug };

    for (const [route, persona] of [
      [listMine, seeded.school.students[0]!],
      [listAll, seeded.school.teachers[0]!],
    ] as const) {
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const response = await callRoute(route, params, {
          headers: persona.headers,
          query: { page_size: "2", ...(cursor ? { cursor } : {}) },
        });
        expect(response.status).toBe(STATUS.ok);
        const body = await json(response);
        seen.push(...(body.data as Json[]).map((row) => row.id as string));
        cursor = (body.next_cursor as string | null) ?? undefined;
        pages += 1;
      } while (cursor);

      expect(pages).toBe(2);
      expect(new Set(seen).size).toBe(3);
    }
  });

  it("answers 422 for a cursor that is not ours and for page sizes out of range", async () => {
    const seeded = await seedSubmission();
    const params = { orgSlug: seeded.school.organization.slug };
    const headers = seeded.school.students[0]!.headers;

    const queries: Record<string, string>[] = [
      { cursor: "garbage" },
      { cursor: Buffer.from("not-a-date|id").toString("base64url") },
      { page_size: "0" },
      { page_size: "101" },
      { page_size: "ten" },
    ];
    for (const query of queries) {
      const response = await callRoute(listMine, params, { headers, query });
      expect(response.status).toBe(STATUS.unprocessable_content);
    }
  });
});
