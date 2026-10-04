import type { Auth } from "@/lib/server/auth-factory";
import type { DbClient } from "@/lib/server/db-types";
import { forbidden, notFound, unauthenticated } from "@/lib/server/errors";
import {
  roles,
  type RoleName,
  type statements,
} from "@/lib/server/permissions";

export interface RequestContext {
  db: DbClient;
  request_id: string;
  organization_id: string;
  organization_slug: string;
  userId: string;
  member_id: string;
  role: RoleName;
  ip_address: string | null;
  user_agent: string | null;
}

type Permissions = {
  [Resource in keyof typeof statements]?: Array<
    (typeof statements)[Resource][number]
  >;
};

function isRoleName(value: string): value is RoleName {
  return value in roles;
}

export async function resolveContext(params: {
  auth: Auth;
  db: DbClient;
  headers: Headers;
  organization_slug: string;
  request_id?: string;
}): Promise<RequestContext> {
  const { auth, db, headers, organization_slug } = params;

  const session = await auth.api.getSession({ headers });
  if (!session) throw unauthenticated();

  const organization = await db.organization.findUnique({
    where: { slug: organization_slug },
  });
  if (!organization) throw notFound();

  const member = await db.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: session.user.id,
      },
    },
  });
  if (!member) throw notFound();
  if (!isRoleName(member.role)) throw forbidden();

  return {
    db,
    request_id: params.request_id ?? crypto.randomUUID(),
    organization_id: organization.id,
    organization_slug: organization.slug,
    userId: session.user.id,
    member_id: member.id,
    role: member.role,
    ip_address: headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: headers.get("user-agent"),
  };
}

export function requireRole(ctx: RequestContext, ...allowed: RoleName[]) {
  if (!allowed.includes(ctx.role)) throw forbidden();
}

export function requirePermission(
  ctx: RequestContext,
  permissions: Permissions,
) {
  const result = roles[ctx.role].authorize(permissions);
  if (!result.success) throw forbidden();
}
