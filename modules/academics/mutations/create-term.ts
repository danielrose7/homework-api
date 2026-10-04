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
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

export async function createTerm(ctx: RequestContext, input: TermInput) {
  requireRole(ctx, "administrator");
  const year = await ctx.db.academicYear.findFirst({
    where: { id: input.academicYearId, organizationId: ctx.organizationId },
  });
  if (!year) {
    throw validationFailed([
      issue("academicYearId", "not_found", "Academic year not found"),
    ]);
  }

  const siblings = await ctx.db.term.findMany({
    where: { organizationId: ctx.organizationId, academicYearId: year.id },
  });
  const issues = [
    ...requireName(input.name),
    ...validateTerm(
      input,
      { startsOn: formatDay(year.startsOn), endsOn: formatDay(year.endsOn) },
      siblings.map((term) => ({
        id: term.id,
        name: term.name,
        startsOn: formatDay(term.startsOn),
        endsOn: formatDay(term.endsOn),
      })),
    ),
  ];
  if (siblings.some((term) => term.name === input.name.trim())) {
    issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.term.create({
    data: {
      organizationId: ctx.organizationId,
      academicYearId: year.id,
      name: input.name.trim(),
      startsOn: day(input.startsOn),
      endsOn: day(input.endsOn),
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "term",
    resourceId: row.id,
  });
  return {
    id: row.id,
    academicYearId: year.id,
    name: row.name,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
  };
}
