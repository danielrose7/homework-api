import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { conflict } from "@/lib/server/errors";
import {
  memberWithRole,
  requireClass,
} from "@/modules/academics/queries/access";

export async function addClassSeat(
  ctx: RequestContext,
  class_id: string,
  member_id: string,
) {
  requireRole(ctx, "administrator");
  const klass = await requireClass(ctx, class_id);
  const member = await memberWithRole(ctx, member_id, "student");
  const existing = await ctx.db.classSeat.findFirst({
    where: {
      organization_id: ctx.organization_id,
      class_id: klass.id,
      member_id: member.id,
    },
  });
  if (existing)
    throw conflict("seat_exists", "Already has a seat in this class");

  const row = await ctx.db.classSeat.create({
    data: {
      organization_id: ctx.organization_id,
      class_id: klass.id,
      member_id: member.id,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resource_type: "class_seat",
    resource_id: row.id,
    metadata: { class_id: klass.id, member_id: member.id },
  });
  return {
    id: row.id,
    class_id: klass.id,
    member_id: member.id,
    status: row.status,
  };
}
