import { z } from "zod";

import type { Auth } from "@/lib/server/auth-factory";
import { resolveContext, type RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import {
  ApiError,
  errorBody,
  notFound,
  validationFailed,
  type ErrorDetail,
} from "@/lib/server/errors";

export interface RouteDeps {
  auth: Auth;
  db: DbClient;
}

export interface RouteInput {
  parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S>;
  params<S extends z.ZodType>(schema: S): z.output<S>;
  query<S extends z.ZodType>(schema: S): z.output<S>;
  body<S extends z.ZodType>(schema: S): Promise<z.output<S>>;
}

export type RouteHandler = (args: {
  ctx: RequestContext;
  request: Request;
  input: RouteInput;
}) => Promise<Response>;

type RouteParams = Record<string, string | string[] | undefined>;

export function zodDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((item) => ({
    field: item.path.join("."),
    code: item.code,
    message: item.message,
  }));
}

function parseWith<S extends z.ZodType>(schema: S, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) throw validationFailed(zodDetails(result.error));
  return result.data;
}

function createInput(request: Request, params: RouteParams): RouteInput {
  return {
    parse: parseWith,
    params: (schema) => parseWith(schema, params),
    query: (schema) =>
      parseWith(schema, Object.fromEntries(new URL(request.url).searchParams)),
    body: async (schema) => {
      const raw: unknown = await request.json().catch(() => {
        throw new ApiError(
          400,
          "invalid_json",
          "Request body is not valid JSON",
        );
      });
      return parseWith(schema, raw);
    },
  };
}

function respond(response: Response, requestId: string): Response {
  response.headers.set("x-request-id", requestId);
  return response;
}

function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) {
    return respond(
      Response.json(errorBody(error), { status: error.status }),
      requestId,
    );
  }
  console.error(`[${requestId}] unhandled error`, error);
  return respond(
    Response.json(
      { error: { code: "internal_error", message: "Something went wrong" } },
      { status: 500 },
    ),
    requestId,
  );
}

export function createServe({ auth, db }: RouteDeps) {
  return function serve(handler: RouteHandler) {
    return async (
      request: Request,
      routeContext: { params: Promise<RouteParams> },
    ): Promise<Response> => {
      const requestId = crypto.randomUUID();
      try {
        const params = await routeContext.params;
        const organizationSlug = params.orgSlug;
        if (typeof organizationSlug !== "string") throw notFound();

        const ctx = await resolveContext({
          auth,
          db,
          headers: request.headers,
          organizationSlug,
          requestId,
        });
        const response = await handler({
          ctx,
          request,
          input: createInput(request, params),
        });
        return respond(response, requestId);
      } catch (error) {
        return errorResponse(error, requestId);
      }
    };
  };
}
