import { issue } from "@/lib/domain/validation";
import type { RequestContext } from "@/lib/server/context";
import {
  deniedAsNotFound,
  forbidden,
  notFound,
  validationFailed,
} from "@/lib/server/errors";

export async function requireClass(ctx: RequestContext, classId: string) {
  const row = await ctx.db.class.findFirst({
    where: { id: classId, organizationId: ctx.organizationId },
  });
  if (!row) throw notFound();
  return row;
}

export async function memberWithRole(
  ctx: RequestContext,
  memberId: string,
  role: "teacher" | "student",
) {
  const member = await ctx.db.member.findFirst({
    where: { id: memberId, organizationId: ctx.organizationId },
  });
  if (!member) {
    throw validationFailed([
      issue("memberId", "not_found", "Member not found"),
    ]);
  }
  if (member.role !== role) {
    throw validationFailed([
      issue("memberId", "wrong_role", `This member is not a ${role}`),
    ]);
  }
  return member;
}

export async function requireTeachesClass(
  ctx: RequestContext,
  classId: string,
) {
  if (ctx.role === "administrator") return;
  if (ctx.role !== "teacher") throw forbidden();
  const assignment = await ctx.db.classTeacher.findFirst({
    where: {
      organizationId: ctx.organizationId,
      classId,
      memberId: ctx.memberId,
    },
  });
  if (!assignment) throw deniedAsNotFound();
}
