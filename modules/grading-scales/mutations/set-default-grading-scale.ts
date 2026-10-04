import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/errors";

export async function setDefaultGradingScale(
  ctx: RequestContext,
  scaleId: string,
): Promise<void> {
  requirePermission(ctx, { gradingScale: ["update"] });
  const scale = await ctx.db.gradingScale.findFirst({
    where: { id: scaleId, organizationId: ctx.organizationId },
  });
  if (!scale) throw notFound();
  if (scale.isDefault) return;

  await ctx.db.gradingScale.updateMany({
    where: { organizationId: ctx.organizationId, isDefault: true },
    data: { isDefault: false },
  });
  await ctx.db.gradingScale.update({
    where: { id: scale.id },
    data: { isDefault: true },
  });
  await recordActivity(ctx.db, ctx, {
    action: "update",
    resourceType: "grading_scale",
    resourceId: scale.id,
    metadata: { changedFields: ["isDefault"] },
  });
}
