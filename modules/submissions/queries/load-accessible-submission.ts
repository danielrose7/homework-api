import type { RequestContext } from "@/lib/server/context";
import { deniedAsNotFound, notFound } from "@/lib/server/errors";
import { requireTeachesClass } from "@/modules/academics/queries/access";

/**
 * Loads a submission the caller may see: its own for a student, one from a class they teach for a teacher, any for
 * an administrator. Everything else is a 404, so other students' work and other schools look absent.
 */
export async function loadAccessibleSubmission(
  ctx: RequestContext,
  submissionId: string,
) {
  const submission = await ctx.db.assignmentSubmission.findFirst({
    where: { id: submissionId, organizationId: ctx.organizationId },
  });
  if (!submission) throw notFound();

  const assignment = await ctx.db.assignment.findFirst({
    where: { id: submission.assignmentId, organizationId: ctx.organizationId },
  });
  if (!assignment) throw notFound();

  const seat = await ctx.db.classSeat.findFirst({
    where: { id: submission.classSeatId, organizationId: ctx.organizationId },
  });
  if (!seat) throw notFound();

  if (ctx.role === "student") {
    if (seat.memberId !== ctx.memberId) throw deniedAsNotFound();
  } else {
    await requireTeachesClass(ctx, assignment.classId);
  }
  return { submission, assignment, seat };
}
