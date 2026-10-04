import { validateRange } from "@/lib/domain/terms";
import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { day, fail, requireName } from "@/modules/academics/validation";

export interface YearInput {
  name: string;
  starts_on: string;
  ends_on: string;
}

export async function createAcademicYear(
  ctx: RequestContext,
  input: YearInput,
) {
  requireRole(ctx, "administrator");
  const issues = [...requireName(input.name), ...validateRange(input)];
  if (issues.length === 0) {
    const taken = await ctx.db.academicYear.findFirst({
      where: { organization_id: ctx.organization_id, name: input.name.trim() },
    });
    if (taken)
      issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.academicYear.create({
    data: {
      organization_id: ctx.organization_id,
      name: input.name.trim(),
      starts_on: day(input.starts_on),
      ends_on: day(input.ends_on),
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resource_type: "academic_year",
    resource_id: row.id,
  });
  return {
    id: row.id,
    name: row.name,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
  };
}
