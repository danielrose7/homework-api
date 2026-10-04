# Audit log and grade history

## `activity_log` — HIPAA-style access log

Student records are FERPA, not HIPAA, but the audit shape is the same. Mirrors `../goji-health`'s `audit_logs`
conventions (`docs/tech-stack.md` → "PHI access logging").

| Group      | Columns                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Who        | `actor_user_id`, `actor_member_id`, `actor_type` (`user`/`system`/`api_key`), `actor_role`, `api_key_id`    |
| What       | `action` (`read`, `create`, `update`, `grade`, `export`, `login`, `denied`), `resource_type`, `resource_id` |
| Where from | `organization_id`, `request_id`, `ip_address`, `user_agent`                                                 |
| Outcome    | `outcome` (`success`/`denied`/`error`)                                                                      |
| When       | `created_at` only (no `updated_at`)                                                                         |
| Extra      | `metadata` jsonb                                                                                            |

Rules:

- **IDs only.** `metadata` holds ids and changed field _names_ — never names, notes or grade contents.
- **Log single-record reads** (submission detail, a student's gradebook). Not list endpoints or searches.
- **Log authorization denials.**
- Mutations: log row written in the **same transaction** as the change (via `recordActivity(tx, …)`).
  Reads and denials are written outside the business transaction so a rollback can't erase them.
- **Append-only:** `app_user` has `INSERT`/`SELECT` only; Prisma extension rejects `update`/`delete`. No triggers.
- Optional later: per-org `prev_hash`/`row_hash` chain for tamper evidence.
- Retention: document one sentence in the README (6 years is the common HIPAA default).
- Reads: admin-only `GET …/activity`; per-submission `GET …/submissions/{id}/history` comes from grade events.
- Students never see revision reasons or the log.

## `submission_grade_event` — grade history

One row per grading action; a regrade adds a row, never edits one. Ordered by `(created_at, id)` — UUIDv7 `id`
breaks ties within a millisecond.

Columns: `organization_id`, `submission_id`, `points_awarded`, `status`, `teacher_notes`, `max_points`
(snapshot), `graded_by` (member), `reason` (required for any event after the first), `created_at`.

The submission row holds the **current** grade (denormalized for fast filtering); `submission.graded_at` equals
the latest event's `created_at`. Events are the source of truth for history.

## Regrade concurrency (timestamps, not revision numbers)

`PATCH …/grade` carries the `graded_at` the client last saw (`If-Unmodified-Since` or body field). If it doesn't
equal the stored value → `409`. First grade carries `null`. Grading runs in a transaction with a row lock on the
submission. Relies on `Timestamptz(3)` (see data-model.md).

## Tests

- Event created per grade; history immutable; reason required on regrade.
- Stale timestamp → `409`; concurrent regrades: one wins.
- Rolled-back mutation leaves no log row; denied/read logs survive rollback.
- `app_user` cannot `UPDATE`/`DELETE` the append-only tables (grant test, not just the Prisma extension).
- ms-precision round-trip of `graded_at` compares equal.
