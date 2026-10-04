# Data model

## Conventions (all tables)

- **PK:** UUIDv7 — `@id @default(uuid(7))` (verify the installed Prisma supports it; otherwise generate in a
  client extension like `../goji-health`'s `newId()`).
- **Timestamps:** every model has
  ```prisma
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(3)
  ```
  - `@default(now())` is a real DB `DEFAULT` on both columns, so inserts from any writer get them.
    `@updatedAt` is set by the Prisma client on update — **no DB trigger**. Therefore no raw-SQL writes in app code.
  - **`Timestamptz(3)` always**: Postgres stores µs, JS `Date` holds ms; a µs column compared with a value that
    round-tripped through JS never matches. Millisecond columns make timestamp-based concurrency checks exact.
  - Exceptions (append-only, `created_at` only): `activity_log`, `submission_grade_event`.
  - Better Auth tables that ship without `updatedAt` (`organization`, `member`, `invitation`) get it added.
- **Naming:** camelCase in TS, `snake_case` columns via `@map` / `@@map`.
- **Tenancy:** every domain table has a NOT NULL `organization_id`, **including child/join/history tables**.
  Parents declare `@@unique([id, organizationId])`; children use composite relations
  `fields: [organizationId, parentId], references: [organizationId, id]` so a child can never reference another
  tenant's parent.
- **Members, not users:** org-scoped references (student, teacher, `graded_by`, `submitted_by`) point at
  `member.id`. A user can belong to several schools.
- **Deletes:** `ON DELETE RESTRICT`; no hard deletes of domain rows. Use statuses (`dropped`, `withdrawn`).
- **Indexes:** `organization_id` is the leading column of any index used by filters/policies.
- **Auth global tables** (`user`, `session`, `account`, `verification`) have no org; keep them in a separate
  Postgres schema (`auth`) — see auth-tenancy-rls.md.

## Tables

| Table                                             | Key columns / notes                                                                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification`      | Better Auth (email + password; username plugin TBD)                                                                                                                                                         |
| `organization` (= school), `member`, `invitation` | Better Auth org plugin. Roles: `administrator`, `teacher`, `student` (+ `owner`)                                                                                                                            |
| `academic_year`                                   | org, name, start/end dates                                                                                                                                                                                  |
| `term`                                            | org, academic_year, name, start/end; no overlap within a year                                                                                                                                               |
| `class`                                           | org, term, name, optional grading-scale override                                                                                                                                                            |
| `class_teacher`                                   | org, class, teacher member (role must be teacher)                                                                                                                                                           |
| `class_seat`                                      | org, class, student member (role must be student), `status` (`active`/`dropped`), `dropped_at`                                                                                                              |
| `assignment`                                      | org, class, title, `type` enum (`homework`, `exam`, `project`, …), `max_points`, `due_at`, `max_submissions` (default 1), `published_at`                                                                    |
| `assignment_submission`                           | org, assignment, `class_seat_id`, `attempt_number`, `content`, `submitted_at`, **current grade**: `points_awarded`, `status` (`submitted`/`graded`/`incomplete`), `teacher_notes`, `graded_at`, `graded_by` |
| `submission_grade_event`                          | append-only grade history — see audit-and-grade-history.md                                                                                                                                                  |
| `activity_log`                                    | append-only audit log — see audit-and-grade-history.md                                                                                                                                                      |

`assignment_submission` references `class_seat` (not a bare student) so a submission can only exist for an
enrolled student. Unique: `(assignment_id, class_seat_id, attempt_number)`.

## Grading rules

- **Letter grade is computed** from `points_awarded / max_points` with a pure function; never stored. A scale
  change then needs no data migration.
- Default US scale: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60. Boundaries are inclusive at the lower edge; decide
  and test rounding explicitly (compare on the raw ratio, don't round first).
- Filter states for the API: `A`–`F`, `incomplete` (teacher marked it), `ungraded` (submitted, no grade yet).
- **"Hasn't submitted"** is derived: active seats × published assignments with no submission row. Exposed as
  `GET …/assignments/{id}/missing`.
- Editing `assignment.max_points` is blocked once any submission is graded (letters would silently change).
  Later: an explicit "regrade all" action that writes grade events with a reason.
- Each grade event stores `max_points` at grading time as a snapshot.

## Submission concurrency (block over-submission)

Three layers; the database is the final guard.

1. Transaction takes a lock on the (assignment, seat) pair (`SELECT … FOR UPDATE` on the seat row or
   `pg_advisory_xact_lock`), counts attempts, inserts with the next `attempt_number`.
2. Unique `(assignment_id, class_seat_id, attempt_number)` rejects any extra row → API returns `409`.
3. `Idempotency-Key` header: a retried/double-clicked request returns the original result.

Also enforce: assignment is published, seat is active, `max_submissions` not exceeded, (decide) due-date policy.
