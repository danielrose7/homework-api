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
- **Log authorization denials.** The route wrapper (`serve`) writes the row, outside the business transaction, when an
  `ApiError` is marked as a denial: every `403` the guards throw, and the refusals that answer `404` on purpose
  (`deniedAsNotFound`: another student's work, a class the teacher does not teach). Each route declares the resource
  it concerns, and the row carries only that resource's id and the HTTP method. Not logged: unauthenticated requests,
  people who are not members of the school, and ids that do not exist; there is no member to attribute them to.
- Mutations: log row written in the **same transaction** as the change (via `recordActivity(tx, …)`).
  Reads and denials are written outside the business transaction so a rollback can't erase them.
- **Append-only:** `app_user` has `INSERT`/`SELECT` only; Prisma extension rejects `update`/`delete`. No triggers.
- Optional later: per-org `prev_hash`/`row_hash` chain for tamper evidence.
- Retention: indefinite for now; a retention/purge policy is a future decision.
- Reads: admin-only `GET …/activity`; per-submission `GET …/submissions/{id}/history` comes from grade events.
- Students never see revision reasons or the log.

## `submission_grade_event` — grade history

One row per grading action; a regrade adds a row, never edits one. Ordered by `(created_at, id)` — UUIDv7 `id`
breaks ties within a millisecond.

Columns: `organization_id`, `submission_id`, `points_awarded` (nullable), `teacher_notes`, `max_points`
(snapshot, nullable), `grading_scale_id`, `grade_band_id`, `grade_label`, `grade_group` (the grade as the student saw it), `graded_by_id` (member), `reason` (required for any event after the first), `created_at`.

The submission row holds the **current** grade (denormalized for fast filtering); `submission.graded_at` equals
the latest event's `created_at`. Events are the source of truth for history.

## Regrade concurrency (timestamps, not revision numbers)

`PUT …/grade` sets the current grade and appends a grade event. The client sends `If-Match` with the ETag it
last received, which is the quoted ISO-8601 `graded_at` at millisecond precision (`"2026-10-04T10:00:00.123Z"`).
A first grade sends no `If-Match`; sending one is a `412`, since there is nothing to match. `If-Match: *` and any value that is not a single quoted ETag are a `400` (`invalid_if_match`), because a wildcard would let a regrade skip the check. Mismatch → `412 Precondition Failed`; header
absent on a regrade → `428 Precondition Required`. (`If-Unmodified-Since` is unusable: HTTP dates are
1-second precision.) Grading runs in a transaction with a row lock on the submission. Relies on `Timestamptz(3)` (see data-model.md).

## Tests

- Event created per grade; history immutable; reason required on regrade.
- Stale ETag → `412`; missing → `428`; concurrent regrades: one wins.
- Rolled-back mutation leaves no log row; denied/read logs survive rollback.
- `app_user` cannot `UPDATE`/`DELETE` the append-only tables (grant test, not just the Prisma extension).
- ms-precision round-trip of `graded_at` compares equal.
