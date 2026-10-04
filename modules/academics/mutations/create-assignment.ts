import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import {
  requireClass,
  requireTeachesClass,
} from "@/modules/academics/queries/access";
import {
  fail,
  scaleIssue,
  validateAssignmentInput,
  type AssignmentInput,
} from "@/modules/academics/validation";

export async function createAssignment(
  ctx: RequestContext,
  classId: string,
  input: AssignmentInput,
) {
  requirePermission(ctx, { assignment: ["create"] });
  const klass = await requireClass(ctx, classId);
  await requireTeachesClass(ctx, klass.id);
  fail([
    ...validateAssignmentInput(input),
    ...(await scaleIssue(ctx.db, ctx.organizationId, input.gradingScaleId)),
  ]);

  const mode = input.gradingMode ?? "points";
  const row = await ctx.db.assignment.create({
    data: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      title: input.title.trim(),
      description: input.description ?? null,
      type: input.type,
      gradingMode: mode,
      maxPoints: mode === "points" ? (input.maxPoints ?? null) : null,
      gradingScaleId: input.gradingScaleId ?? null,
      dueAt: input.dueAt ?? null,
      maxSubmissions: input.maxSubmissions ?? 1,
      publishedAt: input.publish ? new Date() : null,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "assignment",
    resourceId: row.id,
    metadata: { classId: klass.id },
  });
  return row;
}
