import { createAuth } from "@/lib/server/auth-factory";
import { createServe, type RouteHandler } from "@/lib/server/route";
import { testDb } from "@/test/rollback-db";

type RouteParams = Record<string, string>;

export interface CallOptions {
  method?: string;
  query?: Record<string, string>;
  headers?: Headers;
  json?: unknown;
  form?: FormData;
  raw?: string;
}

/** Runs a handler through `serve` with the rolled-back client, as a real request would reach it. */
export async function callRoute(
  handler: RouteHandler,
  params: RouteParams,
  options: CallOptions = {},
): Promise<Response> {
  const serve = createServe({ auth: createAuth(testDb()), db: testDb() });
  const url = new URL("http://localhost/api/v1/test");
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  } else if (options.raw !== undefined) {
    headers.set("content-type", "application/json");
    body = options.raw;
  } else if (options.form) {
    body = options.form;
  }
  return serve(handler)(
    new Request(url, {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
    }),
    { params: Promise.resolve(params) },
  );
}
