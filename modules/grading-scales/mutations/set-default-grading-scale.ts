import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/errors";

export async function setDefaultGradingScale(
  ctx: RequestContext,
  scale_id: string,
): Promise<void> {
  requirePermission(ctx, { grading_scale: ["update"] });
  const scale = await ctx.db.gradingScale.findFirst({
    where: { id: scale_id, organization_id: ctx.organization_id },
  });
  if (!scale) throw notFound();
  if (scale.is_default) return;

  await ctx.db.gradingScale.updateMany({
    where: { organization_id: ctx.organization_id, is_default: true },
    data: { is_default: false },
  });
  await ctx.db.gradingScale.update({
    where: { id: scale.id },
    data: { is_default: true },
  });
  await recordActivity(ctx.db, ctx, {
    action: "update",
    resource_type: "grading_scale",
    resource_id: scale.id,
    metadata: { changed_fields: ["is_default"] },
  });
}
