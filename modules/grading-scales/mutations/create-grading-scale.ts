import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { validationFailed } from "@/lib/server/errors";
import { addBands } from "@/modules/grading-scales/mutations/add-bands";
import { toBand } from "@/modules/grading-scales/serializers";
import type {
  GradingScaleInput,
  ScaleWithBands,
} from "@/modules/grading-scales/types";
import { validateGradingScaleInput } from "@/modules/grading-scales/validation";

export async function createGradingScale(
  ctx: RequestContext,
  input: GradingScaleInput,
): Promise<ScaleWithBands> {
  requirePermission(ctx, { grading_scale: ["create"] });
  const issues = validateGradingScaleInput(input);
  if (issues.length > 0) throw validationFailed(issues);

  const name = input.name.trim();
  const taken = await ctx.db.gradingScale.findFirst({
    where: { organization_id: ctx.organization_id, name },
  });
  if (taken) {
    throw validationFailed([
      issue("name", "name_taken", `A scale named "${name}" already exists`),
    ]);
  }
  if (input.is_default) {
    await ctx.db.gradingScale.updateMany({
      where: { organization_id: ctx.organization_id, is_default: true },
      data: { is_default: false },
    });
  }

  const scale = await ctx.db.gradingScale.create({
    data: {
      organization_id: ctx.organization_id,
      name,
      is_default: input.is_default ?? false,
    },
  });
  await addBands(ctx.db, ctx.organization_id, scale.id, input.bands);
  const bands = await ctx.db.gradingScaleBand.findMany({
    where: { organization_id: ctx.organization_id, grading_scale_id: scale.id },
    orderBy: { sort_order: "asc" },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resource_type: "grading_scale",
    resource_id: scale.id,
  });

  return {
    id: scale.id,
    name: scale.name,
    is_default: scale.is_default,
    bands: bands.map(toBand),
  };
}
