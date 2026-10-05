import { BASE, devJson, send } from "@/app/sandbox/_lib/api";
import type { Exchange } from "@/app/sandbox/_lib/exchange-store";
import {
  isErrorBody,
  type ListResponse,
  type Submission,
} from "@/app/sandbox/_lib/types";
import type { SandboxOptions } from "@/app/sandbox/_server/queries/read-options";
import { ASSIGNMENTS, CLASSES } from "@/app/sandbox/_server/seed-data";

export interface Asserter {
  ok(exchange: Exchange | null, condition: boolean, message: string): void;
  eq(
    exchange: Exchange | null,
    actual: unknown,
    expected: unknown,
    message: string,
  ): void;
}

export interface Check {
  id: string;
  section: "brief" | "guardrails";
  title: string;
  requirement: string;
  run(t: Asserter, call: Caller): Promise<void>;
}

export interface Caller {
  as(user: string): {
    get(path: string): Promise<Exchange>;
    post(path: string, body: object): Promise<Exchange>;
    put(path: string, body: object): Promise<Exchange>;
  };
  options(): Promise<SandboxOptions>;
}

export const caller: Caller = {
  as: (user) => ({
    get: (path) => send({ method: "GET", path, as: user }),
    post: (path, body) => send({ method: "POST", path, body, as: user }),
    put: (path, body) => send({ method: "PUT", path, body, as: user }),
  }),
  options: async () => {
    const options = await devJson<SandboxOptions>("/sandbox/api/options");
    if (!options) throw new Error("could not load sandbox options");
    return options;
  },
};

const page = (exchange: Exchange) =>
  isErrorBody(exchange.json)
    ? []
    : ((exchange.json as ListResponse<Submission>).data ?? []);

const day = (days_ago: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - days_ago * 86_400_000));

const errorOf = (exchange: Exchange) =>
  isErrorBody(exchange.json) ? exchange.json.error : null;

export const CHECKS: Check[] = [
  {
    id: "submit",
    section: "brief",
    title: "A student can submit homework",
    requirement: "Students: submit homework.",
    async run(t, call) {
      const options = await call.options();
      const open =
        options.assignments.find(
          (a) =>
            !options.submissions.some(
              (s) => s.student === "maya" && s.assignment_id === a.id,
            ),
        ) ?? options.assignments[0];
      const exchange = await call
        .as("maya")
        .post(`${BASE}/assignments/${open?.id}/submissions`, {
          text: "Isolated the variable, then substituted to check.",
        });
      const body = exchange.json as Submission;
      t.eq(exchange, exchange.status, 201, "POST returns 201 Created");
      t.ok(
        exchange,
        Boolean(exchange.responseHeaders.location?.endsWith(body.id)),
        "Location header points at the new submission",
      );
      t.ok(
        exchange,
        body.object === "submission" &&
          body.grade === null &&
          body.graded_at === null,
        "the new submission is ungraded (grade and graded_at are null)",
      );
    },
  },
  {
    id: "mine",
    section: "brief",
    title: "A student lists their own submissions",
    requirement: "Students: list own submissions.",
    async run(t, call) {
      const exchange = await call.as("maya").get(`${BASE}/submissions/me`);
      const rows = page(exchange);
      t.eq(exchange, exchange.status, 200, "GET /submissions/me returns 200");
      t.ok(
        exchange,
        (exchange.json as { object?: string }).object === "list" &&
          rows.length > 0,
        "answers a list object with data",
      );
      t.ok(
        exchange,
        rows.every((s) => s.student.username === "maya"),
        "every row belongs to maya",
      );
    },
  },
  {
    id: "mine-grade",
    section: "brief",
    title: "Own submissions filter by grade",
    requirement: "Filter by grade (A-F, incomplete, ungraded).",
    async run(t, call) {
      for (const grade of ["A", "B", "incomplete", "ungraded"]) {
        const exchange = await call
          .as("maya")
          .get(`${BASE}/submissions/me?grade=${grade}`);
        const rows = page(exchange);
        const matches = rows.every((s) =>
          grade === "ungraded"
            ? s.grade === null
            : s.grade?.label.toLowerCase().startsWith(grade.toLowerCase()),
        );
        t.ok(
          exchange,
          exchange.status === 200 && rows.length > 0 && matches,
          `grade=${grade} returns only ${grade} rows (${rows.length})`,
        );
      }
    },
  },
  {
    id: "mine-name",
    section: "brief",
    title: "Own submissions filter by assignment name",
    requirement: "Filter by assignment name.",
    async run(t, call) {
      const exchange = await call
        .as("maya")
        .get(`${BASE}/submissions/me?assignment=GATSBY`);
      const rows = page(exchange);
      t.ok(
        exchange,
        exchange.status === 200 &&
          rows.length > 0 &&
          rows.every((s) => /gatsby/i.test(s.assignment.title)),
        "case-insensitive contains match on the title",
      );
    },
  },
  {
    id: "overview",
    section: "brief",
    title: "A teacher sees an overview of submissions",
    requirement: "Teachers: overview of all submissions.",
    async run(t, call) {
      const taughtClasses = new Set(
        CLASSES.filter((c) => c.teacher === "alvarez").map((c) => c.key),
      );
      const taughtTitles = new Set(
        ASSIGNMENTS.filter((a) => taughtClasses.has(a.class_key)).map(
          (a) => a.title,
        ),
      );
      const teacher = await call
        .as("alvarez")
        .get(`${BASE}/submissions?limit=100`);
      const admin = await call.as("reyes").get(`${BASE}/submissions?limit=100`);
      t.eq(teacher, teacher.status, 200, "teacher gets 200");
      t.ok(
        teacher,
        page(teacher).every((s) => taughtTitles.has(s.assignment.title)),
        "a teacher sees only the classes they teach",
      );
      t.ok(
        admin,
        page(admin).length > page(teacher).length,
        `an administrator sees more (${page(admin).length} vs ${page(teacher).length})`,
      );
    },
  },
  {
    id: "filters",
    section: "brief",
    title: "Teacher filters: assignment, date range, student name",
    requirement:
      "Filter by assignment name, date range (from-to), student name.",
    async run(t, call) {
      const admin = call.as("reyes");
      const essay = await admin.get(`${BASE}/submissions?assignment=essay`);
      t.ok(
        essay,
        page(essay).length > 0 &&
          page(essay).every((s) => /essay/i.test(s.assignment.title)),
        "assignment=essay",
      );
      const priya = await admin.get(`${BASE}/submissions?student=priya`);
      t.ok(
        priya,
        page(priya).length > 0 &&
          page(priya).every((s) => s.student.username === "priya"),
        "student=priya matches name or username",
      );
      const from = day(6);
      const to = day(2);
      const range = await admin.get(
        `${BASE}/submissions?from=${from}&to=${to}`,
      );
      const inRange = page(range).every((s) => {
        const d = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
        }).format(new Date(s.submitted_at));
        return d >= from && d <= to;
      });
      t.ok(
        range,
        page(range).length > 0 && inRange,
        `from=${from}&to=${to} is inclusive and read in the school's time zone`,
      );
    },
  },
  {
    id: "grade",
    section: "brief",
    title: "A teacher grades with a letter and comments",
    requirement: "Teachers: grade a submission (A-F + comments).",
    async run(t, call) {
      const ungraded = await call
        .as("alvarez")
        .get(`${BASE}/submissions?grade=ungraded&limit=100`);
      const target = page(ungraded)[0];
      const options = await call.options();
      const max = Number(
        options.assignments.find((a) => a.id === target?.assignment.id)
          ?.max_points ?? 100,
      );
      const exchange = await call
        .as("alvarez")
        .put(`${BASE}/submissions/${target?.id}/grade`, {
          points: max * 0.9,
          teacher_notes: "Excellent reasoning.",
        });
      const body = exchange.json as Submission;
      t.eq(
        exchange,
        exchange.status,
        200,
        "PUT …/grade returns 200 with the updated submission",
      );
      t.ok(
        exchange,
        body.grade?.label === "A" &&
          body.grade.percent === "90.00" &&
          body.teacher_notes === "Excellent reasoning." &&
          body.graded_at !== null,
        "90% resolves to A on the scale, notes saved, graded_at set",
      );
    },
  },
  {
    id: "fields",
    section: "brief",
    title: "The homework object has every field in the brief",
    requirement:
      "Assignment, student, submission date, grading date, final grade, teacher notes.",
    async run(t, call) {
      const exchange = await call
        .as("reyes")
        .get(`${BASE}/submissions?grade=A&limit=1`);
      const row = page(exchange)[0] ?? ({} as Partial<Submission>);
      for (const field of [
        "assignment",
        "student",
        "submitted_at",
        "graded_at",
        "grade",
        "teacher_notes",
      ]) {
        t.ok(exchange, field in row, `has \`${field}\``);
      }
    },
  },
  {
    id: "403",
    section: "guardrails",
    title: "A student cannot open the teacher overview",
    requirement: "An in-school role failure is 403.",
    async run(t, call) {
      const exchange = await call.as("maya").get(`${BASE}/submissions`);
      t.ok(
        exchange,
        exchange.status === 403 &&
          errorOf(exchange)?.type === "permission_error",
        "403 permission_error",
      );
    },
  },
  {
    id: "409",
    section: "guardrails",
    title: "A second submission is a 409",
    requirement: "Resubmission is blocked by default (max_submissions = 1).",
    async run(t, call) {
      const mine = await call.as("maya").get(`${BASE}/submissions/me?limit=1`);
      const exchange = await call
        .as("maya")
        .post(
          `${BASE}/assignments/${page(mine)[0]?.assignment.id}/submissions`,
          { text: "again" },
        );
      t.ok(
        exchange,
        exchange.status === 409 &&
          errorOf(exchange)?.code === "submission_limit_reached",
        "409 submission_limit_reached",
      );
    },
  },
  {
    id: "422",
    section: "guardrails",
    title: "Validation reports every issue at once",
    requirement: "Zod at the boundary, then validate* rules. Always 422.",
    async run(t, call) {
      const graded = await call
        .as("alvarez")
        .get(`${BASE}/submissions?grade=A&limit=1`);
      const exchange = await call
        .as("alvarez")
        .put(`${BASE}/submissions/${page(graded)[0]?.id}/grade`, {
          points: 999,
          band: "Pass",
        });
      const details = errorOf(exchange)?.details ?? [];
      t.ok(
        exchange,
        exchange.status === 422 && details.length >= 2,
        `422 lists ${details.length} issues: ${details.map((d) => d.code).join(", ")}`,
      );
      const bad = await call
        .as("alvarez")
        .get(`${BASE}/submissions?from=2026-05-02&to=2026-05-01&bogus=1`);
      t.ok(
        bad,
        bad.status === 422,
        "unknown query params and an inverted range are rejected",
      );
    },
  },
  {
    id: "404",
    section: "guardrails",
    title: "Another school looks like it does not exist",
    requirement: "Cross-school requests return 404.",
    async run(t, call) {
      const exchange = await call
        .as("maya")
        .get("/api/v1/orgs/other-school/submissions/me");
      t.eq(exchange, exchange.status, 404, "404, existence is not leaked");
    },
  },
  {
    id: "401",
    section: "guardrails",
    title: "No token means 401",
    requirement: "A bearer token is required.",
    async run(t) {
      const exchange = await send({
        method: "GET",
        path: `${BASE}/submissions/me`,
        auth: "none",
      });
      t.ok(
        exchange,
        exchange.status === 401 &&
          errorOf(exchange)?.type === "authentication_error",
        "401 authentication_error",
      );
    },
  },
];
