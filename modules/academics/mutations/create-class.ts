import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { fail, requireName, scaleIssue } from "@/modules/academics/validation";

export interface ClassInput {
  termId: string;
  name: string;
  gradingScaleId?: string | null;
}

export async function createClass(ctx: RequestContext, input: ClassInput) {
  requireRole(ctx, "administrator");
  const term = await ctx.db.term.findFirst({
    where: { id: input.termId, organizationId: ctx.organizationId },
  });
  const issues = [
    ...requireName(input.name),
    ...(term ? [] : [issue("termId", "not_found", "Term not found")]),
    ...(await scaleIssue(ctx.db, ctx.organizationId, input.gradingScaleId)),
  ];
  if (term) {
    const taken = await ctx.db.class.findFirst({
      where: {
        organizationId: ctx.organizationId,
        termId: term.id,
        name: input.name.trim(),
      },
    });
    if (taken)
      issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.class.create({
    data: {
      organizationId: ctx.organizationId,
      termId: input.termId,
      name: input.name.trim(),
      gradingScaleId: input.gradingScaleId ?? null,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "class",
    resourceId: row.id,
  });
  return {
    id: row.id,
    termId: row.termId,
    name: row.name,
    gradingScaleId: row.gradingScaleId,
  };
}
