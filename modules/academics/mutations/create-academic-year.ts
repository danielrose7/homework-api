import { validateRange } from "@/lib/domain/terms";
import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { day, fail, requireName } from "@/modules/academics/validation";

export interface YearInput {
  name: string;
  startsOn: string;
  endsOn: string;
}

export async function createAcademicYear(
  ctx: RequestContext,
  input: YearInput,
) {
  requireRole(ctx, "administrator");
  const issues = [...requireName(input.name), ...validateRange(input)];
  if (issues.length === 0) {
    const taken = await ctx.db.academicYear.findFirst({
      where: { organizationId: ctx.organizationId, name: input.name.trim() },
    });
    if (taken)
      issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.academicYear.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name.trim(),
      startsOn: day(input.startsOn),
      endsOn: day(input.endsOn),
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "academic_year",
    resourceId: row.id,
  });
  return {
    id: row.id,
    name: row.name,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
  };
}
