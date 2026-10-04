import { describe, expect, it } from "vitest";

import { seedSandbox } from "@/app/sandbox/_server/mutations/seed-sandbox";
import { SANDBOX_PASSWORD } from "@/app/sandbox/_server/seed-data";
import { EXAMPLES, variableName, type RouteExample } from "@/lib/docs/examples";
import { API_ROUTES } from "@/lib/docs/registry";
import { createAuth } from "@/lib/server/auth-factory";

import { callRoute } from "./http";
import { testDb, withRollbackDb } from "./rollback-db";

withRollbackDb();

const SCHOOL = "sandbox";

/** The id a documentation variable stands for when `persona` sends the request, in the freshly seeded school. */
async function resolveVariable(
  variable: string,
  persona: string,
): Promise<string> {
  const db = testDb();
  const ofPersona = { member: { user: { username: persona } } };

  switch (variable) {
    case "ASSIGNMENT_ID": {
      const seats = await db.classSeat.findMany({ where: ofPersona });
      for (const seat of seats) {
        const open = await db.assignment.findFirst({
          where: {
            class_id: seat.class_id,
            published_at: { not: null },
            submissions: { none: { class_seat_id: seat.id } },
          },
          orderBy: { title: "asc" },
        });
        if (open) return open.id;
      }
      throw new Error(`${persona} has no open assignment`);
    }
    case "SUBMISSION_ID":
      return (
        await db.assignmentSubmission.findFirstOrThrow({
          where: { class_seat: ofPersona, grade_label: { not: null } },
          orderBy: { submitted_at: "desc" },
        })
      ).id;
    case "OTHER_SUBMISSION_ID":
      return (
        await db.assignmentSubmission.findFirstOrThrow({
          where: {
            class_seat: { member: { user: { username: { not: persona } } } },
          },
        })
      ).id;
    case "UNGRADED_SUBMISSION_ID": {
      const taught = await db.classTeacher.findMany({ where: ofPersona });
      return (
        await db.assignmentSubmission.findFirstOrThrow({
          where: {
            grade_label: null,
            assignment: {
              grading_mode: "points",
              class_id: { in: taught.map((row) => row.class_id) },
            },
          },
        })
      ).id;
    }
    case "FILE_SUBMISSION_ID":
      return (
        await db.storageAttachment.findFirstOrThrow({
          where: { record_type: "assignment_submission" },
        })
      ).record_id;
    case "ATTACHMENT_ID":
      return (
        await db.storageAttachment.findFirstOrThrow({
          where: { record_type: "assignment_submission" },
        })
      ).id;
    default:
      throw new Error(`no way to resolve ${variable}`);
  }
}

function formFor(example: RouteExample): FormData | undefined {
  if (example.body?.kind !== "multipart") return undefined;
  const form = new FormData();
  for (const [name, value] of Object.entries(example.body.fields)) {
    form.append(name, value);
  }
  for (const file of example.body.files) {
    form.append(
      file.field,
      new File([file.content], file.filename, { type: file.content_type }),
    );
  }
  return form;
}

describe("docs examples", () => {
  it("every example gets the status it documents from the seeded Sandbox school", async () => {
    const auth = createAuth(testDb());
    await seedSandbox(testDb(), auth);

    const tokens = new Map<string, string>();
    async function tokenFor(username: string) {
      const known = tokens.get(username);
      if (known) return known;
      const signedIn = await auth.api.signInUsername({
        body: { username, password: SANDBOX_PASSWORD },
        returnHeaders: true,
      });
      const token = signedIn.headers.get("set-auth-token");
      if (!token) throw new Error(`no token for ${username}`);
      tokens.set(username, token);
      return token;
    }

    const resolved = new Map<string, string>();
    async function idFor(variable: string, persona: string) {
      const key = `${persona}:${variable}`;
      const known = resolved.get(key);
      if (known) return known;
      const id = await resolveVariable(variable, persona);
      resolved.set(key, id);
      return id;
    }

    for (const example of EXAMPLES) {
      const label = `${example.route}: ${example.title}`;
      let status: number;
      let body: unknown;

      if (example.route === "sign_in") {
        const response = await auth.handler(
          new Request("http://localhost:3000/api/auth/sign-in/username", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              example.body?.kind === "json" ? example.body.value : {},
            ),
          }),
        );
        status = response.status;
        body = await response.json();
      } else {
        const route = API_ROUTES.find((r) => r.doc.id === example.route);
        if (!route) throw new Error(`${label}: no such route`);
        const params: Record<string, string> = { org_slug: SCHOOL };
        for (const match of route.doc.path.matchAll(/\{(\w+)\}/g)) {
          const name = match[1] ?? "";
          if (name === "org_slug") continue;
          params[name] = await idFor(
            variableName(example, name),
            example.as ?? "",
          );
        }
        const headers = new Headers();
        if (example.as) {
          headers.set("authorization", `Bearer ${await tokenFor(example.as)}`);
        }
        const form = formFor(example);
        const response = await callRoute(route, params, {
          method: route.doc.method,
          headers,
          query: example.query,
          json: example.body?.kind === "json" ? example.body.value : undefined,
          form,
        });
        status = response.status;
        body = example.save_as ? await response.text() : await response.json();
        if (example.save_as && example.body === undefined) {
          expect(body, label).toBe("Problems 1 to 10, worked by hand.");
        }
      }

      expect(status, `${label}: ${JSON.stringify(body)}`).toBe(
        example.expect.status,
      );
      if (example.expect.code) {
        const { error, code } = body as {
          error?: { code: string };
          code?: string;
        };
        expect(error?.code ?? code, label).toBe(example.expect.code);
      }
    }
  }, 60_000);
});
