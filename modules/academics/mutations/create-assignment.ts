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
  class_id: string,
  input: AssignmentInput,
) {
  requirePermission(ctx, { assignment: ["create"] });
  const klass = await requireClass(ctx, class_id);
  await requireTeachesClass(ctx, klass.id);
  fail([
    ...validateAssignmentInput(input),
    ...(await scaleIssue(ctx.db, ctx.organization_id, input.grading_scale_id)),
  ]);

  const mode = input.grading_mode ?? "points";
  const row = await ctx.db.assignment.create({
    data: {
      organization_id: ctx.organization_id,
      class_id: klass.id,
      title: input.title.trim(),
      description: input.description ?? null,
      type: input.type,
      grading_mode: mode,
      max_points: mode === "points" ? (input.max_points ?? null) : null,
      grading_scale_id: input.grading_scale_id ?? null,
      due_at: input.due_at ?? null,
      max_submissions: input.max_submissions ?? 1,
      published_at: input.publish ? new Date() : null,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resource_type: "assignment",
    resource_id: row.id,
    metadata: { class_id: klass.id },
  });
  return row;
}
