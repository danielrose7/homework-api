import type { z } from "zod";

import type { StatusCode } from "@/lib/http-status";
import type { RoleName } from "@/lib/server/permissions";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteGroup = "Auth" | "Student" | "Teacher" | "Shared";

export interface DocBody {
  content_type: string;
  schema: z.ZodType;
}

export interface DocError {
  status: StatusCode;
  code: string;
  description: string;
}

/** What the docs page and the sandbox console know about one endpoint. Descriptions are Markdown. */
export interface RouteDoc {
  /** Stable slug: anchors on the docs page and keys in the sandbox console. */
  id: string;
  method: HttpMethod;
  /** Full path with `{name}` placeholders, as the filesystem route spells it. */
  path: string;
  group: RouteGroup;
  title: string;
  /** One sentence for lists and tooltips. */
  summary: string;
  description: string;
  roles: readonly RoleName[] | "public";
  /** Path parameters other than `org_slug`. */
  params?: z.ZodType;
  query?: z.ZodType;
  bodies?: readonly DocBody[];
  success: { status: StatusCode; description: string };
  /** Errors specific to this route; the ones every route can return are on the conventions section. */
  errors: readonly DocError[];
}
