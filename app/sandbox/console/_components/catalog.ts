import { BASE } from "@/app/sandbox/_lib/api";
import { roleOf } from "@/app/sandbox/_lib/people";
import type { SandboxOptions } from "@/app/sandbox/_server/queries/read-options";
import { SANDBOX_PASSWORD } from "@/app/sandbox/_server/seed-data";

export interface CatalogItem {
  key: string;
  name: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  note: string;
  auth?: "none";
  /** Query parameter names offered as rows. */
  query?: string[];
}

export const CATALOG: Array<{ group: string; items: CatalogItem[] }> = [
  {
    group: "Auth",
    items: [
      {
        key: "signin",
        name: "Sign in",
        method: "POST",
        path: "/api/auth/sign-in/username",
        auth: "none",
        note: "Returns the bearer token in the body and in the set-auth-token header. A wrong password is 401.",
      },
    ],
  },
  {
    group: "Student",
    items: [
      {
        key: "submit",
        name: "Submit homework",
        method: "POST",
        path: `${BASE}/assignments/{assignment_id}/submissions`,
        note: "201 with Location. 409 submission_limit_reached on a second try, 422 on blank text, 403 for teachers.",
      },
      {
        key: "mine",
        name: "My submissions",
        method: "GET",
        path: `${BASE}/submissions/me`,
        query: ["grade", "assignment", "limit", "starting_after"],
        note: "Filter by grade (A-F, incomplete, ungraded) and assignment name. Newest first.",
      },
    ],
  },
  {
    group: "Teacher",
    items: [
      {
        key: "overview",
        name: "Submissions overview",
        method: "GET",
        path: `${BASE}/submissions`,
        query: [
          "assignment",
          "student",
          "from",
          "to",
          "grade",
          "limit",
          "starting_after",
        ],
        note: "Teachers see their own classes, administrators the whole school. Students get 403.",
      },
      {
        key: "grade",
        name: "Grade a submission",
        method: "PUT",
        path: `${BASE}/submissions/{submission_id}/grade`,
        note: "Send points or band, plus teacher_notes. A regrade needs a reason. Every issue comes back in one 422.",
      },
    ],
  },
  {
    group: "Shared",
    items: [
      {
        key: "get",
        name: "Get a submission",
        method: "GET",
        path: `${BASE}/submissions/{submission_id}`,
        note: "Students read their own. A single-record read is written to the activity log.",
      },
      {
        key: "files",
        name: "List attachments",
        method: "GET",
        path: `${BASE}/submissions/{submission_id}/attachments`,
        note: "Same access rules as the submission.",
      },
    ],
  },
];

export const ALL_ITEMS = CATALOG.flatMap((group) => group.items);

export function sampleBody(key: string, persona: string): object | null {
  if (key === "signin")
    return { username: persona, password: SANDBOX_PASSWORD };
  if (key === "submit")
    return {
      text: "Solved both equations by isolating x, then checked by substitution.",
    };
  if (key === "grade")
    return {
      points: 42,
      teacher_notes: "Clear working, nice check at the end.",
    };
  return null;
}

type Submission = SandboxOptions["submissions"][number];
type Assignment = SandboxOptions["assignments"][number];

export interface Preset {
  label: string;
  /** Replaces the query rows. */
  q?: Record<string, string>;
  body?: (picked: Submission | Assignment | undefined) => object;
  pick?: () => Submission | Assignment | undefined;
  /** Persona to run as; a function receives the picked record. */
  as?: string | ((picked: Submission | Assignment | undefined) => string);
  err?: string;
  note?: string;
  next?: boolean;
}

export interface PresetGroup {
  roles: string[];
  as: string;
  pin?: boolean;
  items: Preset[];
}

const SCHOOL_TZ = "America/New_York";
const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const day = (days_ago: number) =>
  dayFmt.format(new Date(Date.now() - days_ago * 86_400_000));

const points = (s: Submission | undefined, fraction: number) =>
  String(Math.round(Number(s?.max_points ?? 0) * fraction));

export function presetsFor(
  key: string,
  options: SandboxOptions,
  activePersona: string | null,
): PresetGroup | null {
  const subs = options.submissions;
  const asg = options.assignments;
  const ungraded = (mode: string) =>
    subs.find((s) => !s.grade_label && s.grading_mode === mode) ??
    subs.find((s) => s.grading_mode === mode);
  const withReason = (s: Submission | undefined, body: object) =>
    s?.grade_label && s.grade_label !== "Incomplete"
      ? { ...body, reason: "Re-scored after review" }
      : body;
  const regradable =
    subs.find((s) => s.grade_label === "A" && s.grading_mode === "points") ??
    subs[0];
  const mayaOwn = subs.find((s) => s.student === "maya" && s.grade_label);
  const jons = subs.find((s) => s.student === "jon");
  const mayaOpen = asg.find(
    (a) => !subs.some((s) => s.student === "maya" && s.assignment_id === a.id),
  );
  const mayaDone = asg.find((a) => a.id === mayaOwn?.assignment_id);
  const grader = (s: Submission | Assignment | undefined) =>
    roleOf(activePersona) === "administrator" || !s || !("teacher" in s)
      ? (activePersona ?? "reyes")
      : s.teacher;

  const groups: Record<string, PresetGroup> = {
    mine: {
      roles: ["student"],
      as: "maya",
      items: [
        { label: "grade=A", q: { grade: "A" } },
        { label: "grade=B", q: { grade: "B" } },
        { label: "incomplete", q: { grade: "incomplete" } },
        { label: "ungraded", q: { grade: "ungraded" } },
        { label: "assignment=gatsby", q: { assignment: "gatsby" } },
        {
          label: "grade=B + assignment=essay",
          q: { grade: "B", assignment: "essay" },
        },
        { label: "limit=2", q: { limit: "2" }, note: "has_more" },
        { label: "next page", next: true },
        { label: "grade=Z", q: { grade: "Z" }, err: "422" },
        { label: "bogus=1", q: { bogus: "1" }, err: "422" },
      ],
    },
    overview: {
      roles: ["teacher", "administrator"],
      as: "reyes",
      pin: true,
      items: [
        { label: "everything", q: {}, as: "reyes", note: "@reyes" },
        { label: "my classes", q: {}, as: "alvarez", note: "@alvarez" },
        { label: "ungraded", q: { grade: "ungraded" } },
        { label: "grade=F", q: { grade: "F" } },
        { label: "grade=pass", q: { grade: "pass" } },
        { label: "student=priya", q: { student: "priya" } },
        {
          label: "student=lena + grade=A",
          q: { student: "lena", grade: "A" },
        },
        { label: "assignment=essay", q: { assignment: "essay" } },
        { label: "last 7 days", q: { from: day(7) } },
        { label: "5 to 10 days ago", q: { from: day(10), to: day(5) } },
        { label: "limit=3", q: { limit: "3" }, note: "has_more" },
        { label: "next page", next: true },
        { label: "student=p", q: { student: "p" }, err: "422" },
        { label: "from after to", q: { from: day(1), to: day(9) }, err: "422" },
        { label: "grade=Z", q: { grade: "Z" }, err: "422" },
      ],
    },
    submit: {
      roles: ["student"],
      as: "maya",
      items: [
        {
          label: "valid text",
          pick: () => mayaOpen ?? mayaDone,
          body: () => ({
            text: "Isolated the variable, then substituted to check.",
          }),
        },
        {
          label: "already submitted",
          pick: () => mayaDone,
          body: () => ({ text: "Trying again." }),
          err: "409",
        },
        {
          label: "blank text",
          pick: () => mayaOpen ?? mayaDone,
          body: () => ({ text: "   " }),
          err: "422",
        },
        {
          label: "extra field",
          pick: () => mayaOpen ?? mayaDone,
          body: () => ({ text: "hi", late: true }),
          err: "422",
        },
      ],
    },
    grade: {
      roles: ["teacher", "administrator"],
      as: "reyes",
      items: [
        {
          label: "points → A",
          pick: () => ungraded("points"),
          as: grader,
          body: (s) =>
            withReason(s as Submission, {
              points: points(s as Submission, 0.9),
              teacher_notes: "Excellent reasoning.",
            }),
        },
        {
          label: "points → C",
          pick: () => ungraded("points"),
          as: grader,
          body: (s) =>
            withReason(s as Submission, {
              points: points(s as Submission, 0.75),
              teacher_notes: "Solid, check step 3.",
            }),
        },
        {
          label: "pass / fail → Pass",
          pick: () => ungraded("band"),
          as: grader,
          body: (s) =>
            withReason(s as Submission, {
              band: "Pass",
              teacher_notes: "Procedure was complete.",
            }),
        },
        {
          label: "incomplete",
          pick: () => ungraded("points"),
          as: grader,
          body: (s) =>
            withReason(s as Submission, {
              band: "Incomplete",
              teacher_notes: "Missing the last page.",
            }),
        },
        {
          label: "regrade with reason",
          pick: () => regradable,
          as: grader,
          body: (s) => ({
            points: points(s as Submission, 0.8),
            teacher_notes: "Adjusted after review.",
            reason: "Recount after parent meeting",
          }),
        },
        {
          label: "regrade, no reason",
          pick: () => regradable,
          as: grader,
          body: (s) => ({ points: points(s as Submission, 0.8) }),
          err: "422",
        },
        {
          label: "over max + band",
          pick: () => regradable,
          as: grader,
          body: () => ({ points: 999, band: "Pass" }),
          err: "422",
        },
        {
          label: "points on pass/fail",
          pick: () => ungraded("band"),
          as: grader,
          body: () => ({ points: 5 }),
          err: "422",
        },
      ],
    },
    get: {
      roles: ["student", "teacher", "administrator"],
      as: "reyes",
      items: [
        { label: "maya reads her own", pick: () => mayaOwn, as: "maya" },
        {
          label: "teacher reads own class",
          pick: () => regradable,
          as: grader,
        },
        { label: "admin reads any", pick: () => jons, as: "reyes" },
        { label: "maya reads jon's", pick: () => jons, as: "maya", err: "404" },
      ],
    },
    files: {
      roles: ["student", "teacher", "administrator"],
      as: "reyes",
      items: [
        { label: "maya's own", pick: () => mayaOwn, as: "maya" },
        { label: "admin", pick: () => jons, as: "reyes" },
      ],
    },
  };
  return groups[key] ?? null;
}

export const subLabel = (s: Submission) =>
  `${s.student} · ${s.assignment_title} · ${s.grade_label ?? "ungraded"}`;
