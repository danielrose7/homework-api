import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  EXAMPLES,
  EXAMPLE_VARIABLES,
  variableName,
  type RouteExample,
} from "@/lib/docs/examples";
import { ROUTE_DOCS } from "@/lib/docs/registry";
import { LANGUAGES, renderSnippet, type Language } from "@/lib/docs/snippets";
import { SANDBOX_SCHOOL } from "@/app/sandbox/_server/seed-data";

const exec = promisify(execFile);
const PYTHON = process.env.PYTHON ?? "python3";

interface Received {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

let server: Server;
let origin = "";
let received: Received[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        method: request.method ?? "",
        url: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ token: "echoed-token" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const docFor = (example: RouteExample) => {
  const doc = ROUTE_DOCS.find((candidate) => candidate.id === example.route);
  if (!doc) throw new Error(`no route ${example.route}`);
  return doc;
};

const variablesOf = (example: RouteExample) =>
  [...docFor(example).path.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1] ?? "")
    .filter((name) => name !== "org_slug")
    .map((name) => variableName(example, name));

describe("examples", () => {
  it("call documented routes and explain every variable they read", () => {
    const explained = new Set(EXAMPLE_VARIABLES.map((entry) => entry.name));
    for (const example of EXAMPLES) {
      docFor(example);
      for (const variable of variablesOf(example)) {
        expect(explained.has(variable), `${example.title}: ${variable}`).toBe(
          true,
        );
      }
    }
  });

  it("send as people the Sandbox school has, with a token only when signed in", () => {
    for (const example of EXAMPLES) {
      const snippet = renderSnippet(docFor(example), example, "curl");
      expect(snippet.includes("$TOKEN"), example.title).toBe(
        example.as !== null,
      );
    }
  });
});

describe("renderSnippet", () => {
  it("writes the grade request in all three languages", () => {
    const example = EXAMPLES.find(
      (candidate) => candidate.title === "Regrade with a reason",
    );
    if (!example) throw new Error("example missing");
    const doc = docFor(example);

    expect(renderSnippet(doc, example, "curl")).toBe(
      [
        `curl -X PUT "$HOST/api/v1/orgs/sandbox/submissions/$UNGRADED_SUBMISSION_ID/grade" \\`,
        `  -H "Authorization: Bearer $TOKEN" \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  --data-raw '{`,
        `  "points": 92,`,
        `  "teacher_notes": "Full marks on the last problem after review.",`,
        `  "reason": "Recount after parent meeting"`,
        `}'`,
      ].join("\n"),
    );
    expect(renderSnippet(doc, example, "python")).toBe(
      [
        "import os",
        "import requests",
        "",
        `host = os.environ["HOST"]`,
        `token = os.environ["TOKEN"]`,
        `ungraded_submission_id = os.environ["UNGRADED_SUBMISSION_ID"]`,
        "",
        "response = requests.put(",
        `    f"{host}/api/v1/orgs/sandbox/submissions/{ungraded_submission_id}/grade",`,
        `    headers={"Authorization": f"Bearer {token}"},`,
        "    json={",
        `        "points": 92,`,
        `        "teacher_notes": "Full marks on the last problem after review.",`,
        `        "reason": "Recount after parent meeting",`,
        "    },",
        ")",
        "print(response.status_code)",
        "print(response.json())",
      ].join("\n"),
    );
    expect(renderSnippet(doc, example, "node")).toBe(
      [
        "const host = process.env.HOST;",
        "const token = process.env.TOKEN;",
        "const ungradedSubmissionId = process.env.UNGRADED_SUBMISSION_ID;",
        "",
        "const response = await fetch(`${host}/api/v1/orgs/sandbox/submissions/${ungradedSubmissionId}/grade`, {",
        `  method: "PUT",`,
        "  headers: {",
        "    Authorization: `Bearer ${token}`,",
        `    "Content-Type": "application/json",`,
        "  },",
        "  body: JSON.stringify({",
        `    "points": 92,`,
        `    "teacher_notes": "Full marks on the last problem after review.",`,
        `    "reason": "Recount after parent meeting"`,
        "  }),",
        "});",
        "console.log(response.status, await response.json());",
      ].join("\n"),
    );
  });
});

async function pythonHasRequests() {
  try {
    await exec(PYTHON, ["-c", "import requests"]);
    return true;
  } catch {
    return false;
  }
}

async function run(
  language: Language,
  snippet: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
) {
  const command =
    language === "curl"
      ? ["sh", ["-c", snippet]]
      : language === "node"
        ? [process.execPath, ["--input-type=module", "-e", snippet]]
        : [PYTHON, ["-c", snippet]];
  // A snippet may fail after its request went out (curl piping to a missing jq); what it sent is what is checked.
  await exec(command[0] as string, command[1] as string[], { cwd, env }).catch(
    () => undefined,
  );
}

describe.each(LANGUAGES)("$label snippets", ({ id }) => {
  it("send what the example says", async (context) => {
    if (id === "python" && !(await pythonHasRequests())) context.skip();

    for (const example of EXAMPLES) {
      const doc = docFor(example);
      const cwd = mkdtempSync(join(tmpdir(), "docs-snippet-"));
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        HOST: origin,
        TOKEN: "test-token",
      };
      const values = new Map<string, string>();
      for (const variable of variablesOf(example)) {
        values.set(variable, `id-${variable}`);
        env[variable] = `id-${variable}`;
      }
      received = [];

      await run(id, renderSnippet(doc, example, id), cwd, env);

      expect(received, `${id}: ${example.title}`).toHaveLength(1);
      const request = received[0] as Received;
      const path = doc.path
        .replace("{org_slug}", SANDBOX_SCHOOL.slug)
        .replace(
          /\{(\w+)\}/g,
          (_, name: string) => values.get(variableName(example, name)) ?? "",
        );
      const url = new URL(request.url, origin);
      const label = `${id}: ${example.title}`;

      expect(request.method, label).toBe(doc.method);
      expect(url.pathname, label).toBe(path);
      expect(Object.fromEntries(url.searchParams), label).toEqual(
        example.query ?? {},
      );
      expect(request.headers.authorization, label).toBe(
        example.as === null ? undefined : "Bearer test-token",
      );
      const { body } = example;
      if (body?.kind === "json") {
        expect(request.headers["content-type"], label).toMatch(
          /^application\/json/,
        );
        expect(JSON.parse(request.body), label).toEqual(body.value);
      } else if (body?.kind === "multipart") {
        expect(request.headers["content-type"], label).toMatch(
          /^multipart\/form-data/,
        );
        for (const value of Object.values(body.fields)) {
          expect(request.body, label).toContain(value);
        }
        for (const file of body.files) {
          expect(request.body, label).toContain(`filename="${file.filename}"`);
          expect(request.body, label).toContain(file.content);
          expect(request.body, label).toContain(file.content_type);
        }
      } else {
        expect(request.body, label).toBe("");
      }
      if (example.save_as) {
        const saved = join(cwd, example.save_as);
        expect(existsSync(saved), label).toBe(true);
        expect(readFileSync(saved, "utf8"), label).toContain("echoed-token");
      }
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 120_000);
});
