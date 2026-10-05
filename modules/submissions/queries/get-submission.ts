import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import { toSubmissionView } from "@/modules/submissions/serializers";
import { loadAccessibleSubmission } from "@/modules/submissions/utils/load-accessible-submission";
import {
  submissionInclude,
  type SubmissionView,
} from "@/modules/submissions/types";

async function loadSubmissionView(
  ctx: RequestContext,
  submission_id: string,
): Promise<SubmissionView> {
  const { submission } = await loadAccessibleSubmission(ctx, submission_id);

  return toSubmissionView(
    await ctx.db.assignmentSubmission.findFirstOrThrow({
      where: { id: submission.id, organization_id: ctx.organization_id },
      include: submissionInclude,
    }),
  );
}

export async function getSubmission(
  ctx: RequestContext,
  submission_id: string,
): Promise<SubmissionView> {
  requirePermission(ctx, { submission: ["read"] });
  return loadSubmissionView(ctx, submission_id);
}

export async function readSubmission(
  ctx: RequestContext,
  submission_id: string,
): Promise<SubmissionView> {
  const view = await getSubmission(ctx, submission_id);
  await recordActivity(ctx.db, ctx, {
    action: "read",
    resource_type: "submission",
    resource_id: submission_id,
  });
  return view;
}
