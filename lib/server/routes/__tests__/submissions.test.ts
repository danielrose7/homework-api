import { describe, expect, it } from "vitest";

import { listMine, submit } from "@/lib/server/routes/submissions";
import { callRoute } from "@/test/http";
import { seedAssignment, seedSubmission } from "@/test/scenarios/class";
import { withRollbackDb } from "@/test/rollback-db";

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

    expect(response.status).toBe(201);
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

    expect(response.status).toBe(201);
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

    expect(response.status).toBe(422);
    const error = await errorOf(response);
    expect(error.details).toEqual([
      expect.objectContaining({ field: "files.0.file", code: "file_empty" }),
      expect.objectContaining({
        field: "files.1.contentType",
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

    expect((await send(seeded.assignment.id, {})).status).toBe(422);
    expect(
      (await send(seeded.assignment.id, { text: "x", extra: 1 })).status,
    ).toBe(422);
    expect((await send("not-a-uuid", { text: "x" })).status).toBe(422);
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

    expect(response.status).toBe(400);
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

    expect(again.status).toBe(409);
    expect((await errorOf(again)).code).toBe("submission_limit_reached");
    expect(teacher.status).toBe(403);
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

    expect(response.status).toBe(401);
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

    expect(response.status).toBe(200);
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

    expect(response.status).toBe(422);
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

    expect(response.status).toBe(422);
    expect((await errorOf(response)).details?.[0]?.code).toBe("unknown_grade");
  });

  it("answers 403 for a teacher", async () => {
    const seeded = await seedSubmission();

    const response = await callRoute(
      listMine,
      { orgSlug: seeded.school.organization.slug },
      { headers: seeded.school.teachers[0]!.headers },
    );

    expect(response.status).toBe(403);
  });
});
