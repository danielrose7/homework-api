import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { toSubmissionView } from "@/modules/submissions/serializers";
import { loadAccessibleSubmission } from "@/modules/submissions/queries/load-accessible-submission";
import {
  submissionInclude,
  type SubmissionView,
} from "@/modules/submissions/types";

async function loadSubmissionView(
  ctx: RequestContext,
  submissionId: string,
): Promise<SubmissionView> {
  const { submission } = await loadAccessibleSubmission(ctx, submissionId);

  return toSubmissionView(
    await ctx.db.assignmentSubmission.findFirstOrThrow({
      where: { id: submission.id, organizationId: ctx.organizationId },
      include: submissionInclude,
    }),
  );
}

export async function getSubmission(
  ctx: RequestContext,
  submissionId: string,
): Promise<SubmissionView> {
  requirePermission(ctx, { submission: ["read"] });
  return loadSubmissionView(ctx, submissionId);
}

export async function readSubmission(
  ctx: RequestContext,
  submissionId: string,
): Promise<SubmissionView> {
  const view = await getSubmission(ctx, submissionId);
  await recordActivity(ctx.db, ctx, {
    action: "read",
    resourceType: "submission",
    resourceId: submissionId,
  });
  return view;
}
