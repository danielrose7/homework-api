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
  requestId: string;
  organizationId: string;
  organizationSlug: string;
  userId: string;
  memberId: string;
  role: RoleName;
  ipAddress: string | null;
  userAgent: string | null;
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
  organizationSlug: string;
  requestId?: string;
}): Promise<RequestContext> {
  const { auth, db, headers, organizationSlug } = params;

  const session = await auth.api.getSession({ headers });
  if (!session) throw unauthenticated();

  const organization = await db.organization.findUnique({
    where: { slug: organizationSlug },
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
    requestId: params.requestId ?? crypto.randomUUID(),
    organizationId: organization.id,
    organizationSlug: organization.slug,
    userId: session.user.id,
    memberId: member.id,
    role: member.role,
    ipAddress: headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: headers.get("user-agent"),
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
