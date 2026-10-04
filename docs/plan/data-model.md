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
- **Deletes:** `ON DELETE RESTRICT`; the API never hard-deletes. See "Soft deletes and FERPA" below.
- **Indexes:** `organization_id` is the leading column of any index used by filters/policies.
- **Auth global tables** (`user`, `session`, `account`, `verification`) have no org; keep them in a separate
  Postgres schema (`auth`) — see auth-and-tenancy.md.

## Tables

| Table                                             | Key columns / notes                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user`, `session`, `account`, `verification`      | Better Auth (username + password sign-in; email required but contact-only)                                                                                                                                                                                                     |
| `organization` (= school), `member`, `invitation` | Better Auth org plugin. Roles: `administrator`, `teacher`, `student` (+ `owner`)                                                                                                                                                                                               |
| `academic_year`                                   | org, name, start/end dates                                                                                                                                                                                                                                                     |
| `term`                                            | org, academic_year, name, start/end; no overlap within a year                                                                                                                                                                                                                  |
| `grading_scale`                                   | org, name, `is_default`, optional `supersedes_id`; one default per school; see Grading scales                                                                                                                                                                                  |
| `grading_scale_band`                              | org, scale, `label`, `group_label`, `min_percent`, `gpa_points`, `is_passing`, `sort_order`                                                                                                                                                                                    |
| `class`                                           | org, term, name, optional `grading_scale_id` override                                                                                                                                                                                                                          |
| `class_teacher`                                   | org, class, teacher member (role must be teacher)                                                                                                                                                                                                                              |
| `class_seat`                                      | org, class, student member (role must be student), `status` (`active`/`dropped`), `dropped_at`                                                                                                                                                                                 |
| `assignment`                                      | org, class, title, `type` enum (`homework`, `exam`, `project`, …), `max_points`, optional `grading_scale_id` override, `due_at`, `max_submissions` (default 1), `published_at`                                                                                                 |
| `assignment_submission`                           | org, assignment, `class_seat_id`, `attempt_number`, `content`, `submitted_at`, **current grade**: `points_awarded`, `status` (`submitted`/`graded`/`incomplete`), `grading_scale_id`, `grade_band_id`, `grade_label`, `grade_group`, `teacher_notes`, `graded_at`, `graded_by` |
| `submission_grade_event`                          | append-only grade history — see audit-and-grade-history.md                                                                                                                                                                                                                     |
| `activity_log`                                    | append-only audit log — see audit-and-grade-history.md                                                                                                                                                                                                                         |

`assignment_submission` references `class_seat` (not a bare student) so a submission can only exist for an
enrolled student. Unique: `(assignment_id, class_seat_id, attempt_number)`.

## Grading scales

Scales are data, not code, so +/- letters, pass/fail and other schemes need no deploy.

- **`grading_scale`**: belongs to a school; `is_default` marks the school default (partial unique index: one
  default per school among non-deleted rows). Every new school gets a default "Standard A–F" scale, created in
  Better Auth's `afterCreateOrganization` hook.
- **`grading_scale_band`**: `label` (`B+`, `Pass`), `group_label` (`B`; null means the label is its own group),
  `min_percent` (inclusive lower bound, `numeric(6,2)`), `gpa_points` (nullable), `is_passing`, `sort_order`.
  Unique `(scale, min_percent)` and `(scale, label)` among non-deleted rows.
- **Valid scale:** has a band at `min_percent = 0`, no duplicate thresholds, at least one band. The top band is
  open-ended so extra credit above 100% still resolves.
- **Resolution order:** `assignment.grading_scale_id` → `class.grading_scale_id` → the school default. This is how
  a pass/fail assignment lives inside a lettered class.
- **Lookup** is the highest band whose `min_percent` is at or below the percentage. Compare with exact decimals
  (`points * 100 >= min_percent * max_points`), not floats and not a pre-rounded percentage. Points and
  `max_points` are `numeric(7,2)`.
- Seed examples: "Standard A–F" (90/80/70/60/0), "Plus/minus" (A+ … F), "Pass/Fail" (60/0).

### Stored result, immutable scales

This reverses the earlier "letter grade is never stored". If scales are editable, recomputing would silently
relabel grades students already saw.

- At grading time the resolved result is **snapshotted** on the submission and the grade event: `grading_scale_id`,
  `grade_band_id`, `grade_label`, `grade_group` (the latter two denormalized for filtering without a join).
- Bands and the scale are **immutable once any grade references them**. "Editing" a used scale creates a new
  scale (`supersedes_id` points at the old one) and the school default moves to it; existing grades keep the old
  label. Unused scales can be replaced freely (old bands are soft-deleted).
- Re-labelling existing work is an explicit action ("regrade with scale X") that writes grade events with a reason.
- Soft-deleting a scale is blocked while it is the default or referenced.

## Grade states and filters

- `grade` filter matches `grade_label` or `grade_group`, case-insensitively: `B` matches B+/B/B- and `B+` matches
  only B+. A plain A–F scale makes both the same. Other values: `incomplete` (teacher marked it, no band) and
  `ungraded` (submitted, no grade yet).
- **"Hasn't submitted"** is derived: active seats × published assignments with no submission row. Exposed as
  `GET …/assignments/{id}/missing`.
- Editing `assignment.max_points` or its scale is blocked once any submission is graded. Later: an explicit
  "regrade all" action that writes grade events with a reason.
- Each grade event stores `max_points` at grading time as a snapshot.

## Submission concurrency (block over-submission)

Three layers; the database is the final guard.

1. Transaction takes a lock on the (assignment, seat) pair (`SELECT … FOR UPDATE` on the seat row or
   `pg_advisory_xact_lock`), counts attempts, inserts with the next `attempt_number`.
2. Unique `(assignment_id, class_seat_id, attempt_number)` rejects any extra row → API returns `409`.
3. `Idempotency-Key` header: a retried/double-clicked request returns the original result.

Also enforce: assignment is published, seat is active, `max_submissions` not exceeded, (decide) due-date policy.

## Soft deletes and FERPA

FERPA gives eligible students/parents rights to inspect and request amendment of education records and requires
schools to keep a record of disclosures; it does **not** grant a GDPR-style erasure right or fix a retention
period (those come from state/district schedules). So deletion here is "stop showing it, keep it recoverable and
auditable, purge on a defined schedule". This supports a FERPA-compliant deployment; it does not by itself make
one, and retention periods are configuration, not hard-coded. Not legal advice — have counsel confirm.

- **Columns** (soft-deletable domain tables: `academic_year`, `term`, `class`, `class_teacher`, `class_seat`,
  `assignment`, `assignment_submission`): `deletedAt DateTime? @db.Timestamptz(3)`, `deletedBy` (member id),
  `deletionReason`. Append-only tables (`activity_log`, `submission_grade_event`) are never soft-deleted.
- **Default invisibility:** a Prisma client extension adds `deletedAt: null` to reads. It does not cover raw SQL
  or relation includes reliably, so a guard test checks the extension and raw queries are
  banned in app code.
- **Uniqueness:** natural-key unique constraints become partial indexes `WHERE deleted_at IS NULL` (hand-written
  migration SQL; Prisma can't express them) so a deleted name can be reused.
- **What `DELETE` may do:** terms, classes, assignments, seats (drop) and teacher assignments by admins. A
  submission is an education record: soft-delete is admin-only with a required reason, and a student cannot
  delete a graded one. Deleting a parent is blocked while live children exist (`RESTRICT` semantics at the
  service layer), not cascaded.
- **Restore:** `POST …/{id}/restore` (admin) clears the three columns; both actions are logged.
- **Disclosure record:** `activity_log` doubles as the FERPA disclosure/access record, so exports and
  third-party reads are logged with `action = export`. Because it holds IDs only, it survives a purge without
  retaining student content.
- **Purge (hard delete):** a separate admin-only, logged operation, not exposed through the resource routes. It
  removes soft-deleted rows older than the org's retention window (config), grade events included, and is
  refused while a hold or an open records request exists (a `records_hold` flag on the org/student is a later
  addition). Users are tombstoned (PII scrubbed, id retained) rather than row-deleted so history stays joinable.
- **Amendment requests:** handled as normal regrades/edits with a reason, not deletion.
