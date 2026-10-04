import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { conflict } from "@/lib/server/errors";
import {
  memberWithRole,
  requireClass,
} from "@/modules/academics/queries/access";

export async function addClassSeat(
  ctx: RequestContext,
  classId: string,
  memberId: string,
) {
  requireRole(ctx, "administrator");
  const klass = await requireClass(ctx, classId);
  const member = await memberWithRole(ctx, memberId, "student");
  const existing = await ctx.db.classSeat.findFirst({
    where: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  if (existing)
    throw conflict("seat_exists", "Already has a seat in this class");

  const row = await ctx.db.classSeat.create({
    data: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "class_seat",
    resourceId: row.id,
    metadata: { classId: klass.id, memberId: member.id },
  });
  return {
    id: row.id,
    classId: klass.id,
    memberId: member.id,
    status: row.status,
  };
}
