import { issue } from "@/lib/domain/validation";
import type { RequestContext } from "@/lib/server/context";
import {
  deniedAsNotFound,
  forbidden,
  notFound,
  validationFailed,
} from "@/lib/server/errors";

export async function requireClass(ctx: RequestContext, class_id: string) {
  const row = await ctx.db.class.findFirst({
    where: { id: class_id, organization_id: ctx.organization_id },
  });
  if (!row) throw notFound();
  return row;
}

export async function memberWithRole(
  ctx: RequestContext,
  member_id: string,
  role: "teacher" | "student",
) {
  const member = await ctx.db.member.findFirst({
    where: { id: member_id, organizationId: ctx.organization_id },
  });
  if (!member) {
    throw validationFailed([
      issue("member_id", "not_found", "Member not found"),
    ]);
  }
  if (member.role !== role) {
    throw validationFailed([
      issue("member_id", "wrong_role", `This member is not a ${role}`),
    ]);
  }
  return member;
}

export async function requireTeachesClass(
  ctx: RequestContext,
  class_id: string,
) {
  if (ctx.role === "administrator") return;
  if (ctx.role !== "teacher") throw forbidden();
  const assignment = await ctx.db.classTeacher.findFirst({
    where: {
      organization_id: ctx.organization_id,
      class_id,
      member_id: ctx.member_id,
    },
  });
  if (!assignment) throw deniedAsNotFound();
}
