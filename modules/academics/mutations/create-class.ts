import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { fail, requireName, scaleIssue } from "@/modules/academics/validation";

export interface ClassInput {
  term_id: string;
  name: string;
  grading_scale_id?: string | null;
}

export async function createClass(ctx: RequestContext, input: ClassInput) {
  requireRole(ctx, "administrator");
  const term = await ctx.db.term.findFirst({
    where: { id: input.term_id, organization_id: ctx.organization_id },
  });
  const issues = [
    ...requireName(input.name),
    ...(term ? [] : [issue("term_id", "not_found", "Term not found")]),
    ...(await scaleIssue(ctx.db, ctx.organization_id, input.grading_scale_id)),
  ];
  if (term) {
    const taken = await ctx.db.class.findFirst({
      where: {
        organization_id: ctx.organization_id,
        term_id: term.id,
        name: input.name.trim(),
      },
    });
    if (taken)
      issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.class.create({
    data: {
      organization_id: ctx.organization_id,
      term_id: input.term_id,
      name: input.name.trim(),
      grading_scale_id: input.grading_scale_id ?? null,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resource_type: "class",
    resource_id: row.id,
  });
  return {
    id: row.id,
    term_id: row.term_id,
    name: row.name,
    grading_scale_id: row.grading_scale_id,
  };
}
