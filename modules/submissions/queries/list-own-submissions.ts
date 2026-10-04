import {
  requirePermission,
  requireRole,
  type RequestContext,
} from "@/lib/server/context";
import { listSubmissions } from "@/modules/submissions/queries/list-submissions";
import type {
  SubmissionFilters,
  SubmissionPage,
} from "@/modules/submissions/types";

export async function listOwnSubmissions(
  ctx: RequestContext,
  filters: SubmissionFilters,
): Promise<SubmissionPage> {
  requirePermission(ctx, { submission: ["read"] });
  requireRole(ctx, "student");

  return listSubmissions(
    ctx,
    { class_seat: { member_id: ctx.member_id } },
    filters,
  );
}
