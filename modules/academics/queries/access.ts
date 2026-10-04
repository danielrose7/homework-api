import type { RequestContext } from "@/lib/server/context";
import { deniedAsNotFound, forbidden } from "@/lib/server/errors";

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
