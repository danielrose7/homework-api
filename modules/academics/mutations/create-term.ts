import { validateTerm } from "@/lib/domain/terms";
import { issue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import { requireRole, type RequestContext } from "@/lib/server/context";
import { validationFailed } from "@/lib/server/errors";
import {
  day,
  fail,
  formatDay,
  requireName,
} from "@/modules/academics/validation";

export interface TermInput {
  academic_year_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

export async function createTerm(ctx: RequestContext, input: TermInput) {
  requireRole(ctx, "administrator");
  const year = await ctx.db.academicYear.findFirst({
    where: { id: input.academic_year_id, organization_id: ctx.organization_id },
  });
  if (!year) {
    throw validationFailed([
      issue("academic_year_id", "not_found", "Academic year not found"),
    ]);
  }

  const siblings = await ctx.db.term.findMany({
    where: { organization_id: ctx.organization_id, academic_year_id: year.id },
  });
  const issues = [
    ...requireName(input.name),
    ...validateTerm(
      input,
      {
        starts_on: formatDay(year.starts_on),
        ends_on: formatDay(year.ends_on),
      },
      siblings.map((term) => ({
        id: term.id,
        name: term.name,
        starts_on: formatDay(term.starts_on),
        ends_on: formatDay(term.ends_on),
      })),
    ),
  ];
  if (siblings.some((term) => term.name === input.name.trim())) {
    issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.term.create({
    data: {
      organization_id: ctx.organization_id,
      academic_year_id: year.id,
      name: input.name.trim(),
      starts_on: day(input.starts_on),
      ends_on: day(input.ends_on),
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resource_type: "term",
    resource_id: row.id,
  });
  return {
    id: row.id,
    academic_year_id: year.id,
    name: row.name,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
  };
}
