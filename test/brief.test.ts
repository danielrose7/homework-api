import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { grade } from "@/lib/server/routes/grades";
import { listAll, listMine, submit } from "@/lib/server/routes/submissions";
import { callRoute } from "@/test/http";
import { seedAssignment } from "@/test/scenarios/class";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

type Json = Record<string, unknown>;
const json = async (response: Response) => (await response.json()) as Json;

type Result = { points: number } | { band: string } | null;

/** One school, one class, two students and a teacher, with helpers that act only through the HTTP routes. */
async function classroom() {
  const base = await seedAssignment({
    students: 2,
    assignment: { title: "Warm-up", maxPoints: "100" },
  });
  const orgSlug = base.school.organization.slug;
  const [maya, sam] = base.school.students;
  const teacher = base.school.teachers[0]!;

  await testDb().user.update({
    where: { id: maya!.member.user.id },
    data: { name: "Maya Chen", username: "mchen" },
  });
  await testDb().user.update({
    where: { id: sam!.member.user.id },
    data: { name: "Sam Ortiz", username: "sortiz" },
  });

  async function turnIn(
    who: typeof maya,
    title: string,
    result: Result = null,
    notes?: string,
  ) {
    const { assignment } = await seedAssignment({
      seeded: base,
      assignment: { title, maxPoints: "100" },
    });
    const submitted = await callRoute(
      submit,
      { orgSlug, assignmentId: assignment.id },
      { headers: who!.headers, json: { text: `${title} answer` } },
    );
    expect(submitted.status).toBe(STATUS.created);
    const { id } = await json(submitted);

    if (result) {
      const graded = await callRoute(
        grade,
        { orgSlug, submissionId: id as string },
        {
          method: "PUT",
          headers: teacher.headers,
          json: { ...result, teacher_notes: notes },
        },
      );
      expect(graded.status).toBe(STATUS.ok);
    }
    return { id: id as string };
  }

  const titles = async (
    route: typeof listMine,
    headers: Headers,
    query: Record<string, string> = {},
  ) => {
    const response = await callRoute(route, { orgSlug }, { headers, query });
    expect(response.status).toBe(STATUS.ok);
    return ((await json(response)).data as Json[]).map(
      (row) => (row.assignment as Json).title,
    );
  };

  return { base, orgSlug, maya: maya!, sam: sam!, teacher, turnIn, titles };
}

describe("brief: students", () => {
  it("submit homework and see it in their own list", async () => {
    const { maya, sam, turnIn, titles } = await classroom();

    await turnIn(maya, "Fractions");
    await turnIn(sam, "Poetry");

    expect(await titles(listMine, maya.headers)).toEqual(["Fractions"]);
    expect(await titles(listMine, sam.headers)).toEqual(["Poetry"]);
  });

  it("filter their submissions by grade: A to F, incomplete and ungraded", async () => {
    const { maya, turnIn, titles } = await classroom();
    await turnIn(maya, "Gets A", { points: 95 });
    await turnIn(maya, "Gets B", { points: 85 });
    await turnIn(maya, "Gets C", { points: 75 });
    await turnIn(maya, "Gets D", { points: 65 });
    await turnIn(maya, "Gets F", { points: 30 });
    await turnIn(maya, "Marked incomplete", { band: "Incomplete" });
    await turnIn(maya, "Not graded yet");

    for (const [filter, expected] of [
      ["A", "Gets A"],
      ["B", "Gets B"],
      ["C", "Gets C"],
      ["D", "Gets D"],
      ["F", "Gets F"],
      ["incomplete", "Marked incomplete"],
      ["ungraded", "Not graded yet"],
    ] as const) {
      expect(await titles(listMine, maya.headers, { grade: filter })).toEqual([
        expected,
      ]);
    }
  });

  it("filter their submissions by assignment name", async () => {
    const { maya, turnIn, titles } = await classroom();
    await turnIn(maya, "Fractions worksheet");
    await turnIn(maya, "Fractions quiz");
    await turnIn(maya, "Poetry");

    expect(
      (
        await titles(listMine, maya.headers, { assignment: "fractions" })
      ).sort(),
    ).toEqual(["Fractions quiz", "Fractions worksheet"]);
  });
});

describe("brief: teachers", () => {
  it("see an overview of every student's submissions", async () => {
    const { maya, sam, teacher, turnIn, titles } = await classroom();
    await turnIn(maya, "Fractions");
    await turnIn(sam, "Poetry");

    expect((await titles(listAll, teacher.headers)).sort()).toEqual([
      "Fractions",
      "Poetry",
    ]);
  });

  it("filter by assignment name, student name and date range", async () => {
    const { maya, sam, teacher, turnIn, titles } = await classroom();
    const fractions = await turnIn(maya, "Fractions");
    const poetry = await turnIn(sam, "Poetry");
    for (const [id, at] of [
      [fractions.id, "2026-03-10T03:30:00Z"],
      [poetry.id, "2026-03-10T15:00:00Z"],
    ] as const) {
      await testDb().assignmentSubmission.update({
        where: { id },
        data: { submittedAt: new Date(at) },
      });
    }

    expect(
      await titles(listAll, teacher.headers, { assignment: "poet" }),
    ).toEqual(["Poetry"]);
    expect(await titles(listAll, teacher.headers, { student: "chen" })).toEqual(
      ["Fractions"],
    );
    expect(await titles(listAll, teacher.headers, { student: "Sam" })).toEqual([
      "Poetry",
    ]);
    expect(
      await titles(listAll, teacher.headers, {
        from: "2026-03-09",
        to: "2026-03-09",
      }),
    ).toEqual(["Fractions"]);
    expect(
      await titles(listAll, teacher.headers, {
        from: "2026-03-10",
        to: "2026-03-10",
      }),
    ).toEqual(["Poetry"]);
  });

  it("grade a submission with a letter and comments that the student then sees", async () => {
    const { maya, teacher, turnIn, orgSlug } = await classroom();
    const { id } = await turnIn(maya, "Fractions");

    const graded = await callRoute(
      grade,
      { orgSlug, submissionId: id },
      {
        method: "PUT",
        headers: teacher.headers,
        json: { points: 92, teacher_notes: "Careful work on question 4." },
      },
    );
    expect(graded.status).toBe(STATUS.ok);

    const mine = await callRoute(
      listMine,
      { orgSlug },
      { headers: maya.headers },
    );
    const [row] = (await json(mine)).data as Json[];
    expect(row).toEqual({
      id,
      assignment: { id: expect.any(String), title: "Fractions" },
      student: {
        member_id: maya.member.id,
        name: "Maya Chen",
        username: "mchen",
      },
      attempt_number: 1,
      text: "Fractions answer",
      submitted_at: expect.stringMatching(/Z$/),
      graded_at: expect.stringMatching(/Z$/),
      teacher_notes: "Careful work on question 4.",
      grade: {
        label: "A",
        group: "A",
        points_awarded: "92.00",
        max_points: "100.00",
        percent: "92.00",
        scale_id: expect.any(String),
      },
    });
  });
});
