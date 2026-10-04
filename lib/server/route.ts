import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { recordActivity, type ResourceType } from "@/lib/server/activity";
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

export interface RouteDefinition {
  /** What the route is about, so a denied request is logged against it. */
  resource: ResourceType;
  /** The path parameter holding that resource's id, when the route has one. */
  id_param?: string;
  handle: RouteHandler;
}

export const defineRoute = (definition: RouteDefinition) => definition;

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
          STATUS.bad_request,
          "invalid_json",
          "Request body is not valid JSON",
        );
      });
      return parseWith(schema, raw);
    },
  };
}

function respond(response: Response, request_id: string): Response {
  response.headers.set("x-request-id", request_id);
  return response;
}

function errorResponse(error: unknown, request_id: string): Response {
  if (error instanceof ApiError) {
    return respond(
      Response.json(errorBody(error), { status: error.status }),
      request_id,
    );
  }
  console.error(`[${request_id}] unhandled error`, error);
  return respond(
    Response.json(
      {
        error: {
          type: "api_error",
          code: "internal_error",
          message: "Something went wrong",
        },
      },
      { status: STATUS.internal_server_error },
    ),
    request_id,
  );
}

async function logDenial(
  db: DbClient,
  ctx: RequestContext,
  request: Request,
  definition: RouteDefinition,
  params: RouteParams,
) {
  const id = definition.id_param ? params[definition.id_param] : undefined;
  try {
    await recordActivity(db, ctx, {
      action: "denied",
      resource_type: definition.resource,
      resource_id: z.uuid().safeParse(id).success ? (id as string) : null,
      outcome: "denied",
      metadata: { method: request.method },
    });
  } catch (error) {
    console.error(`[${ctx.request_id}] could not log a denial`, error);
  }
}

export function createServe({ auth, db }: RouteDeps) {
  return function serve(definition: RouteDefinition) {
    return async (
      request: Request,
      routeContext: { params: Promise<RouteParams> },
    ): Promise<Response> => {
      const request_id = crypto.randomUUID();
      let ctx: RequestContext | undefined;
      let params: RouteParams = {};
      try {
        params = await routeContext.params;
        const organization_slug = params.org_slug;
        if (typeof organization_slug !== "string") throw notFound();

        ctx = await resolveContext({
          auth,
          db,
          headers: request.headers,
          organization_slug,
          request_id,
        });
        const response = await definition.handle({
          ctx,
          request,
          input: createInput(request, params),
        });
        return respond(response, request_id);
      } catch (error) {
        if (error instanceof ApiError && error.denial && ctx) {
          await logDenial(db, ctx, request, definition, params);
        }
        return errorResponse(error, request_id);
      }
    };
  };
}
