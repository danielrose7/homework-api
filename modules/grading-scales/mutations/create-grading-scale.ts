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
  requirePermission(ctx, { gradingScale: ["create"] });
  const issues = validateGradingScaleInput(input);
  if (issues.length > 0) throw validationFailed(issues);

  const name = input.name.trim();
  const taken = await ctx.db.gradingScale.findFirst({
    where: { organizationId: ctx.organizationId, name },
  });
  if (taken) {
    throw validationFailed([
      issue("name", "name_taken", `A scale named "${name}" already exists`),
    ]);
  }
  if (input.isDefault) {
    await ctx.db.gradingScale.updateMany({
      where: { organizationId: ctx.organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const scale = await ctx.db.gradingScale.create({
    data: {
      organizationId: ctx.organizationId,
      name,
      isDefault: input.isDefault ?? false,
    },
  });
  await addBands(ctx.db, ctx.organizationId, scale.id, input.bands);
  const bands = await ctx.db.gradingScaleBand.findMany({
    where: { organizationId: ctx.organizationId, gradingScaleId: scale.id },
    orderBy: { sortOrder: "asc" },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "grading_scale",
    resourceId: scale.id,
  });

  return {
    id: scale.id,
    name: scale.name,
    isDefault: scale.isDefault,
    bands: bands.map(toBand),
  };
}
