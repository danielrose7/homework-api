import type { RequestContext } from "@/lib/server/context";
import { deniedAsNotFound, notFound } from "@/lib/server/errors";
import { requireTeachesClass } from "@/lib/server/access";

/**
 * Loads a submission the caller may see: its own for a student, one from a class they teach for a teacher, any for
 * an administrator. Everything else is a 404, so other students' work and other schools look absent.
 */
export async function loadAccessibleSubmission(
  ctx: RequestContext,
  submission_id: string,
) {
  const submission = await ctx.db.assignmentSubmission.findFirst({
    where: { id: submission_id, organization_id: ctx.organization_id },
  });
  if (!submission) throw notFound();

  const assignment = await ctx.db.assignment.findFirst({
    where: {
      id: submission.assignment_id,
      organization_id: ctx.organization_id,
    },
  });
  if (!assignment) throw notFound();

  const seat = await ctx.db.classSeat.findFirst({
    where: {
      id: submission.class_seat_id,
      organization_id: ctx.organization_id,
    },
  });
  if (!seat) throw notFound();

  if (ctx.role === "student") {
    if (seat.member_id !== ctx.member_id) throw deniedAsNotFound();
  } else {
    await requireTeachesClass(ctx, assignment.class_id);
  }
  return { submission, assignment, seat };
}
