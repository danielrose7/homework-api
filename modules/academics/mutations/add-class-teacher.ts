import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { conflict } from "@/lib/server/errors";
import {
  memberWithRole,
  requireClass,
} from "@/modules/academics/queries/access";

export async function addClassTeacher(
  ctx: RequestContext,
  classId: string,
  memberId: string,
) {
  requireRole(ctx, "administrator");
  const klass = await requireClass(ctx, classId);
  const member = await memberWithRole(ctx, memberId, "teacher");
  const existing = await ctx.db.classTeacher.findFirst({
    where: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  if (existing)
    throw conflict("already_assigned", "Already teaching this class");

  const row = await ctx.db.classTeacher.create({
    data: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "class_teacher",
    resourceId: row.id,
    metadata: { classId: klass.id, memberId: member.id },
  });
  return { id: row.id, classId: klass.id, memberId: member.id };
}
