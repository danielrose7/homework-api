import type { RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";

export type ActivityAction =
  | "read"
  | "create"
  | "update"
  | "grade"
  | "delete"
  | "restore"
  | "export"
  | "login"
  | "denied"
  | "reset";

export type ResourceType =
  | "academic_year"
  | "term"
  | "grading_scale"
  | "class"
  | "class_teacher"
  | "class_seat"
  | "assignment"
  | "submission"
  | "attachment"
  | "grade"
  | "activity_log"
  | "system";

export type ActivityOutcome = "success" | "denied" | "error";

export type ActivityMetadata = Record<
  string,
  string | number | boolean | null | string[]
>;

export interface ActivityEntry {
  action: ActivityAction;
  resource_type: ResourceType;
  resource_id?: string | null;
  outcome?: ActivityOutcome;
  metadata?: ActivityMetadata;
}

/** Keys that would carry personal or graded content. The log holds identifiers and field names only. */
const FORBIDDEN_KEYS = new Set([
  "name",
  "email",
  "username",
  "password",
  "token",
  "notes",
  "teachernotes",
  "content",
  "text",
  "textcontent",
  "title",
  "description",
  "comment",
  "reason",
  "points",
  "pointsawarded",
  "label",
  "gradelabel",
  "filename",
  "originalfilename",
]);

export function assertIdOnlyMetadata(metadata: ActivityMetadata) {
  for (const key of Object.keys(metadata)) {
    const normalized_key = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    if (FORBIDDEN_KEYS.has(normalized_key)) {
      throw new Error(
        `Activity metadata may hold ids and field names only, not "${key}"`,
      );
    }
  }
}

/**
 * Appends one audit row. Pass the business transaction as `db` for mutations so the row commits or rolls back
 * with the change; pass a separate connection for reads and denials so a rollback cannot erase them.
 */
export async function recordActivity(
  db: DbClient,
  ctx: RequestContext,
  entry: ActivityEntry,
): Promise<string> {
  if (entry.metadata) assertIdOnlyMetadata(entry.metadata);

  const row = await db.activityLog.create({
    data: {
      organization_id: ctx.organization_id,
      actor_type: "user",
      actor_user_id: ctx.userId,
      actor_member_id: ctx.member_id,
      actor_role: ctx.role,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      outcome: entry.outcome ?? "success",
      request_id: ctx.request_id,
      ip_address: ctx.ip_address,
      user_agent: ctx.user_agent,
      metadata: entry.metadata ?? undefined,
    },
  });
  return row.id;
}
