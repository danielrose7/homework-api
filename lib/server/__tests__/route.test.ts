import { toNextJsHandler } from "better-auth/next-js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { createAuth } from "@/lib/server/auth-factory";
import { conflict } from "@/lib/server/errors";
import {
  createServe,
  defineRoute,
  type RouteHandler,
} from "@/lib/server/route";
import { testDb, withRollbackDb } from "@/test/rollback-db";
import { seedSchool } from "@/test/scenarios/school";

withRollbackDb();

function serveWith(handler: RouteHandler) {
  return createServe({ auth: createAuth(testDb()), db: testDb() })(
    defineRoute({ resource: "system", handle: handler }),
  );
}

function call(
  route: ReturnType<typeof serveWith>,
  slug: string,
  init: {
    url?: string;
    headers?: Headers;
    method?: string;
    body?: string;
  } = {},
) {
  const { url = "http://localhost/test", ...rest } = init;
  return route(new Request(url, rest), {
    params: Promise.resolve({ orgSlug: slug }),
  });
}

const whoAmI = () =>
  serveWith(async ({ ctx }) =>
    Response.json({ role: ctx.role, slug: ctx.organizationSlug }),
  );

describe("Better Auth over HTTP", () => {
  it("lets a client sign up, sign in for a token and create a school", async () => {
    const { POST } = toNextJsHandler(createAuth(testDb()));
    const post = (path: string, body: unknown, headers: HeadersInit = {}) =>
      POST(
        new Request(`http://localhost:3000/api/auth/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        }),
      );

    const signUp = await post("sign-up/email", {
      name: "Ms. Alvarez",
      email: "alvarez@sandbox.test",
      password: "correct-horse-battery",
      username: "alvarez",
    });
    expect(signUp.status).toBe(STATUS.ok);

    const signIn = await post("sign-in/username", {
      username: "alvarez",
      password: "correct-horse-battery",
    });
    const token = signIn.headers.get("set-auth-token");
    expect(token).toBeTruthy();

    const created = await post(
      "organization/create",
      { name: "Sandbox", slug: "sandbox" },
      { authorization: `Bearer ${token}` },
    );
    expect(created.status).toBe(STATUS.ok);

    const response = await call(whoAmI(), "sandbox", {
      headers: new Headers({ authorization: `Bearer ${token}` }),
    });
    expect(response.status).toBe(STATUS.ok);
    expect(await response.json()).toEqual({
      role: "administrator",
      slug: "sandbox",
    });
  });
});

describe("serve", () => {
  it("builds the request context from the bearer token and school slug", async () => {
    const school = await seedSchool();

    const response = await call(whoAmI(), school.organization.slug, {
      headers: school.students[0]!.headers,
    });

    expect(response.status).toBe(STATUS.ok);
    expect(await response.json()).toEqual({
      role: "student",
      slug: school.organization.slug,
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns 401 without a token, in the shared error shape", async () => {
    const school = await seedSchool();

    const response = await call(whoAmI(), school.organization.slug);

    expect(response.status).toBe(STATUS.unauthorized);
    expect(await response.json()).toEqual({
      error: { code: "unauthenticated", message: "Authentication required" },
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns 404 for a school the caller does not belong to, and for one that does not exist", async () => {
    const mine = await seedSchool();
    const other = await seedSchool();
    const headers = mine.students[0]!.headers;

    const foreign = await call(whoAmI(), other.organization.slug, { headers });
    const missing = await call(whoAmI(), "no-such-school", { headers });

    expect(foreign.status).toBe(STATUS.not_found);
    expect(missing.status).toBe(STATUS.not_found);
    expect(await foreign.json()).toEqual(await missing.json());
  });

  it("lists every query issue in one 422", async () => {
    const school = await seedSchool();
    const route = serveWith(async ({ input }) => {
      const query = input.query(
        z.object({
          from: z.iso.date(),
          page_size: z.coerce.number().int().min(1).max(100),
        }),
      );
      return Response.json(query);
    });

    const response = await call(route, school.organization.slug, {
      url: "http://localhost/test?from=yesterday&page_size=500",
      headers: school.admin.headers,
    });

    expect(response.status).toBe(STATUS.unprocessable_content);
    const body: { error: { code: string; details: { field: string }[] } } =
      await response.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details.map((detail) => detail.field).sort()).toEqual([
      "from",
      "page_size",
    ]);
  });

  it("parses a JSON body and rejects one that is not JSON with 400", async () => {
    const school = await seedSchool();
    const route = serveWith(async ({ input }) =>
      Response.json(await input.body(z.object({ text: z.string() }))),
    );
    const headers = school.students[0]!.headers;

    const ok = await call(route, school.organization.slug, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "my essay" }),
    });
    const bad = await call(route, school.organization.slug, {
      method: "POST",
      headers,
      body: "{nope",
    });
    const wrongShape = await call(route, school.organization.slug, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: 7 }),
    });

    expect(await ok.json()).toEqual({ text: "my essay" });
    expect(bad.status).toBe(STATUS.bad_request);
    expect((await bad.json()).error.code).toBe("invalid_json");
    expect(wrongShape.status).toBe(STATUS.unprocessable_content);
  });

  it("turns an ApiError thrown by a handler into its status and code", async () => {
    const school = await seedSchool();
    const route = serveWith(async () => {
      throw conflict("submission_limit_reached", "Already submitted");
    });

    const response = await call(route, school.organization.slug, {
      headers: school.students[0]!.headers,
    });

    expect(response.status).toBe(STATUS.conflict);
    expect(await response.json()).toEqual({
      error: {
        code: "submission_limit_reached",
        message: "Already submitted",
      },
    });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const school = await seedSchool();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = serveWith(async () => {
      throw new Error("connection string postgres://secret");
    });

    const response = await call(route, school.organization.slug, {
      headers: school.students[0]!.headers,
    });

    expect(response.status).toBe(STATUS.internal_server_error);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
