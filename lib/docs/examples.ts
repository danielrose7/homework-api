import { SANDBOX_PASSWORD } from "@/app/sandbox/_server/seed-data";
import { STATUS, type StatusCode } from "@/lib/http-status";

export interface ExampleFile {
  field: string;
  filename: string;
  content_type: string;
  content: string;
}

export type ExampleBody =
  | { kind: "json"; value: unknown }
  | { kind: "multipart"; fields: Record<string, string>; files: ExampleFile[] };

/**
 * One request to one route. The curl, Python and Node snippets are all generated from it, and
 * `test/docs-examples.test.ts` runs it against the seeded Sandbox school.
 */
export interface RouteExample {
  /** `RouteDoc.id` of the route it calls. */
  route: string;
  title: string;
  /** Sandbox username the request is sent as; null sends no token. */
  as: string | null;
  /** Path parameters read from an environment variable other than the default (`ASSIGNMENT_ID` for `{assignment_id}`). */
  variables?: Record<string, string>;
  query?: Record<string, string>;
  body?: ExampleBody;
  /** Where the response body is saved, for routes that return a file. */
  save_as?: string;
  /** Keep a field of the response in `TOKEN` for the requests that follow. */
  keeps_token?: boolean;
  expect: { status: StatusCode; code?: string };
}

/** The environment variables the snippets read, and what each one holds in the Sandbox school. */
export const EXAMPLE_VARIABLES: ReadonlyArray<{
  name: string;
  description: string;
}> = [
  {
    name: "HOST",
    description: "Where the app runs, such as `http://localhost:3000`.",
  },
  {
    name: "TOKEN",
    description:
      "The bearer token from signing in as the person named in the example.",
  },
  {
    name: "ASSIGNMENT_ID",
    description:
      "An assignment the signed-in student has not handed in. For `maya` that is Cell structure worksheet, for `jon` Quadratics problem set.",
  },
  {
    name: "SUBMISSION_ID",
    description:
      "A submission the signed-in person may read, such as one of `maya`'s from her list.",
  },
  {
    name: "OTHER_SUBMISSION_ID",
    description: "A submission that belongs to a different student.",
  },
  {
    name: "UNGRADED_SUBMISSION_ID",
    description:
      "A points-graded submission with no grade yet, in a class the teacher teaches. For `alvarez` that is `lena`'s Quadratics problem set.",
  },
  {
    name: "FILE_SUBMISSION_ID",
    description:
      "A submission with an attached file, such as the one the multipart example creates.",
  },
  {
    name: "ATTACHMENT_ID",
    description: "The `id` of a file on that submission.",
  },
];

const text = (value: string): ExampleBody => ({
  kind: "json",
  value: { text: value },
});

export const EXAMPLES: readonly RouteExample[] = [
  {
    route: "sign_in",
    title: "Sign in",
    as: null,
    body: {
      kind: "json",
      value: { username: "maya", password: SANDBOX_PASSWORD },
    },
    keeps_token: true,
    expect: { status: STATUS.ok },
  },
  {
    route: "sign_in",
    title: "Wrong password",
    as: null,
    body: {
      kind: "json",
      value: { username: "maya", password: "not-the-password" },
    },
    expect: {
      status: STATUS.unauthorized,
      code: "INVALID_USERNAME_OR_PASSWORD",
    },
  },
  {
    route: "submit",
    title: "Submit text",
    as: "maya",
    body: text("Labeled every organelle and wrote a sentence on each."),
    expect: { status: STATUS.created },
  },
  {
    route: "submit",
    title: "Submit again",
    as: "maya",
    body: text("Trying a second time."),
    expect: { status: STATUS.conflict, code: "submission_limit_reached" },
  },
  {
    route: "submit",
    title: "Blank text",
    as: "maya",
    body: text("   "),
    expect: { status: STATUS.unprocessable_content, code: "validation_failed" },
  },
  {
    route: "submit",
    title: "Submit text and a file",
    as: "jon",
    body: {
      kind: "multipart",
      fields: { text: "Worked solutions are attached." },
      files: [
        {
          field: "files",
          filename: "notes.txt",
          content_type: "text/plain",
          content: "Problems 1 to 10, worked by hand.",
        },
      ],
    },
    expect: { status: STATUS.created },
  },
  {
    route: "list_own",
    title: "List my submissions",
    as: "maya",
    expect: { status: STATUS.ok },
  },
  {
    route: "list_own",
    title: "Filter by grade and assignment",
    as: "maya",
    query: { grade: "B", assignment: "gatsby" },
    expect: { status: STATUS.ok },
  },
  {
    route: "list_own",
    title: "A grade the school does not use",
    as: "maya",
    query: { grade: "Z" },
    expect: { status: STATUS.unprocessable_content, code: "validation_failed" },
  },
  {
    route: "list_overview",
    title: "Filter by student and date",
    as: "alvarez",
    query: { student: "lena", from: "2026-01-01", limit: "10" },
    expect: { status: STATUS.ok },
  },
  {
    route: "list_overview",
    title: "A student is refused",
    as: "maya",
    expect: { status: STATUS.forbidden, code: "forbidden" },
  },
  {
    route: "grade",
    title: "Grade with points",
    as: "alvarez",
    variables: { submission_id: "UNGRADED_SUBMISSION_ID" },
    body: {
      kind: "json",
      value: { points: 88, teacher_notes: "Clear working throughout." },
    },
    expect: { status: STATUS.ok },
  },
  {
    route: "grade",
    title: "Regrade without a reason",
    as: "alvarez",
    variables: { submission_id: "UNGRADED_SUBMISSION_ID" },
    body: { kind: "json", value: { points: 92 } },
    expect: { status: STATUS.unprocessable_content, code: "validation_failed" },
  },
  {
    route: "grade",
    title: "Regrade with a reason",
    as: "alvarez",
    variables: { submission_id: "UNGRADED_SUBMISSION_ID" },
    body: {
      kind: "json",
      value: {
        points: 92,
        teacher_notes: "Full marks on the last problem after review.",
        reason: "Recount after parent meeting",
      },
    },
    expect: { status: STATUS.ok },
  },
  {
    route: "get",
    title: "Read one of my submissions",
    as: "maya",
    expect: { status: STATUS.ok },
  },
  {
    route: "get",
    title: "Another student's submission",
    as: "maya",
    variables: { submission_id: "OTHER_SUBMISSION_ID" },
    expect: { status: STATUS.not_found, code: "not_found" },
  },
  {
    route: "list_attachments",
    title: "List the files on a submission",
    as: "jon",
    variables: { submission_id: "FILE_SUBMISSION_ID" },
    expect: { status: STATUS.ok },
  },
  {
    route: "download_attachment",
    title: "Download a file",
    as: "jon",
    variables: { submission_id: "FILE_SUBMISSION_ID" },
    save_as: "notes.txt",
    expect: { status: STATUS.ok },
  },
];

/** The environment variable that stands for a path parameter in this example's snippets. */
export function variableName(example: RouteExample, parameter: string) {
  return example.variables?.[parameter] ?? parameter.toUpperCase();
}
