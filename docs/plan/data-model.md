# Data model

## Conventions (all tables)

The short checklist lives in [schema-conventions.md](schema-conventions.md); this section explains the reasoning.

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
- **Members, not users:** org-scoped references (student, teacher, `graded_by_id`, `submitted_by`) point at
  `member.id`. A user can belong to several schools.
- **Deletes:** `ON DELETE RESTRICT`; the API never hard-deletes. See "Soft deletes and FERPA" below.
- **Indexes:** `organization_id` is the leading column of any index used by filters/policies.
- **Auth global tables** (`user`, `session`, `account`, `verification`) have no org and live in `public` — see
  auth-and-tenancy.md.

## Tables

| Table                                             | Key columns / notes                                                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification`      | Better Auth (username + password sign-in; email required but contact-only)                                                                                                                                                                                |
| `organization` (= school), `member`, `invitation` | Better Auth org plugin. Roles: `administrator`, `teacher`, `student` (+ `owner`)                                                                                                                                                                          |
| `organization_preferences`                        | org (one row per school), `timezone` (IANA name, default `America/New_York`); created with the school                                                                                                                                                     |
| `academic_year`                                   | org, name, start/end dates                                                                                                                                                                                                                                |
| `term`                                            | org, academic_year, name, start/end; no overlap within a year                                                                                                                                                                                             |
| `grading_scale`                                   | org, name, `is_default`, optional `supersedes_id`; one default per school; see Grading scales                                                                                                                                                             |
| `grading_scale_band`                              | org, scale, `label`, `group_label`, `min_percent`, `gpa_points`, `is_passing`, `sort_order`                                                                                                                                                               |
| `class`                                           | org, term, name, optional `grading_scale_id` override                                                                                                                                                                                                     |
| `class_teacher`                                   | org, class, teacher member (role must be teacher)                                                                                                                                                                                                         |
| `class_seat`                                      | org, class, student member (role must be student), `status` (`active`/`dropped`), `dropped_at`                                                                                                                                                            |
| `assignment`                                      | org, class, title, `type` enum (`homework`, `exam`, `project`, …), `grading_mode` (`points`/`band`), `max_points` (null in `band` mode), optional `grading_scale_id` override, `due_at`, `max_submissions` (default 1), `published_at`                    |
| `assignment_submission`                           | org, assignment, `class_seat_id`, `attempt_number`, `content`, `submitted_at`, **current grade**: `points_awarded` (null in `band` mode), `grading_scale_id`, `grade_band_id`, `grade_label`, `grade_group`, `teacher_notes`, `graded_at`, `graded_by_id` |
| `storage_blob`                                    | org, `key`, `filename`, `content_type`, `byte_size`, `checksum` (sha256), `service_name` (where the bytes live), `metadata` json, `uploaded_by`; immutable                                                                                                |
| `storage_blob_data`                               | org, blob (one-to-one), `content` bytea; only for `service_name = database`; immutable                                                                                                                                                                    |
| `storage_attachment`                              | org, blob, polymorphic `record_type` + `record_id` + `name`; soft-deletable                                                                                                                                                                               |
| `submission_grade_event`                          | append-only grade history — see audit-and-grade-history.md                                                                                                                                                                                                |
| `activity_log`                                    | append-only audit log — see audit-and-grade-history.md                                                                                                                                                                                                    |

`assignment_submission` references `class_seat` (not a bare student) so a submission can only exist for an
enrolled student. Unique: `(assignment_id, class_seat_id, attempt_number)`.

## Grading scales

Scales are data, not code, so +/- letters, pass/fail and other schemes need no deploy.

- **`grading_scale`**: belongs to a school; `is_default` marks the school default (partial unique index: one
  default per school among non-deleted rows). Every new school gets a default "Standard A–F" scale, created in
  Better Auth's `afterCreateOrganization` hook.
- **`grading_scale_band`**: `label` (`B+`, `Pass`), `group_label` (`B`; null means the label is its own group),
  `min_percent` (inclusive lower bound, `numeric(6,2)`; **null means manual-only**), `gpa_points` (nullable),
  `is_passing` (null means neutral), `counts_in_average`, `sort_order`. Unique `(scale, min_percent)` (non-null
  values) and `(scale, label)` among non-deleted rows. `ungraded` is a reserved word and cannot be a label.
- **Valid scale:** has a computed band at `min_percent = 0`, no duplicate thresholds. Manual-only bands are optional. The top band is
  open-ended, so any score at or above the highest threshold resolves.
- **Resolution order:** `assignment.grading_scale_id` → `class.grading_scale_id` → the school default. This is how
  a pass/fail assignment lives inside a lettered class.
- **Lookup** is the highest computed band whose `min_percent` is at or below the percentage; manual-only bands are
  never produced by it. Compare with exact decimals
  (`points * 100 >= min_percent * max_points`), not floats and not a pre-rounded percentage. Points and
  `max_points` are `numeric(7,2)`.
- Seed examples: "Standard A–F" (90/80/70/60/0), "Plus/minus" (A+ … F), "Pass/Fail" (60/0).

### Incomplete

"Incomplete" is a **grade**, not a status or a null: the brief lists it beside A–F as a value a teacher can give.
It is a manual-only, neutral band (`min_percent` null, `is_passing` null, `counts_in_average` false) that the
default scales include. Points never produce it; the teacher picks it. It is excluded from averages until
replaced by a real grade through a regrade (the `reason` is optional when replacing an Incomplete).
`ungraded` is different: no band at all. A submission is ungraded exactly when `grade_band_id` is null, so there
is no `status` column. Whether an Incomplete should convert to a failing grade after a deadline is a future decision.

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

## Grading modes (points vs. pass/fail)

Pass/fail comes in two shapes, so `assignment.grading_mode` has two values:

- **`points`**: the teacher enters points; the band comes from the scale lookup. This covers lettered work and also
  "pass at 60%" using a Pass/Fail scale. `max_points` is required and greater than zero. The teacher may instead
  pick a manual-only band such as Incomplete, which stores no points.
- **`band`**: the teacher picks a band directly (`Pass`, `Fail`, or any label on the resolved scale). There are no
  points and no percentage, so `max_points` is null.

Rules:

- In both modes `grade_band_id` is the authoritative result; `grade_label`/`grade_group` are copies of it.
- Check constraints (hand-written migration SQL, Prisma can't express them):
  - `points` mode: `max_points IS NOT NULL AND max_points > 0`.
  - A graded submission has `grade_band_id` set. `points_awarded` is set in `points` mode unless the band is
    manual-only, and is null in `band` mode.
  - An ungraded submission has every grade column null.
- `submission_grade_event.points_awarded` and `max_points` are nullable for the same reason.
- `grading_mode`, `max_points` and the scale cannot change after the first grade is given.
- "Fail" is a graded result that counts in averages. Incomplete is neutral and does not.
- Class averages (not built) would only use `points`-mode work; `band`-mode work has no percentage to average.
- Grade payload is a discriminated union, validated against the assignment's mode:
  `{ "points": 42, "teacher_notes": … }` or `{ "band": "Pass", "teacher_notes": … }`. In `points` mode `band` may
  only name a manual-only band. The wrong shape is `422`. The band label is resolved against the assignment's
  resolved scale, never across scales.

## Grade states and filters

- `grade` filter matches `grade_label` or `grade_group`, case-insensitively: `B` matches B+/B/B- and `B+` matches
  only B+. A plain A–F scale makes both the same, and `incomplete` is just another label. The one reserved value
  is `ungraded` (submitted, no band yet).
- **"Hasn't submitted"** is derived: active seats × published assignments with no submission row. Exposed as
  `GET …/assignments/{id}/missing`.
- Editing `assignment.max_points` or its scale is blocked once any submission is graded. Later: an explicit
  "regrade all" action that writes grade events with a reason.
- Each grade event stores `max_points` at grading time as a snapshot.

## Submission contents and attachments (Active Storage style)

Modelled on Rails Active Storage, which separates _what a file is_ from _what it is attached to_ and from _where
its bytes live_:

| Rails                            | Here                 | Role                                                                       |
| -------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| `active_storage_blobs`           | `storage_blob`       | File metadata: key, filename, content type, size, checksum, `service_name` |
| `active_storage_attachments`     | `storage_attachment` | Polymorphic link: `record_type`, `record_id`, `name`, blob                 |
| database storage service table   | `storage_blob_data`  | The bytes, one row per blob, kept out of blob listings                     |
| `active_storage_variant_records` | not built            | No image processing                                                        |

- **Service name, not a flag.** `storage_blob.service_name` selects a `StorageService` in code
  (`lib/server/storage`). Only `database` exists. Moving to R2/S3 means a new service, copying a blob's bytes out of
  `storage_blob_data`, and changing its `service_name`; no schema change.
- **Immutable blobs.** The runtime role can only insert and read blobs and their bytes (grants plus the client
  extension). Replacing a file means a new blob and a new attachment.
- **Polymorphic attachments.** `record_type` is an enum (today only `assignment_submission`); `record_id` has no
  foreign key, as in Rails, so the service verifies the record in the same school. Detaching is a soft delete; the
  blob is kept (retention is indefinite).
- **Two steps.** Upload creates an unattached blob, then attach links it, like a Rails direct upload. Phase 3's
  multipart submit will do both in the submission's transaction.
- **Validation (`422`):** file name required and sanitized to its last path segment; non-empty; at most 5 MB; content
  type on an allow-list; bytes must match the declared type (PDF, PNG, JPEG, GIF, WebP, HEIC/HEIF/AVIF, ZIP and text are sniffed); at most 5
  files per record per name. Attaching to graded work is a `409`; attaching the same blob twice is a `409`.
- **Access.** A student sees their own submission's files, a teacher those of classes they teach, an administrator
  any in the school; everything else is `404`. Each download writes a `read` to the activity log with ids only.
- List queries never select `content`.

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
auditable, retained indefinitely". Retention is indefinite for this product; a purge feature is a future
decision. This supports a FERPA-compliant deployment; it does not by itself make one. Not legal advice — have
counsel confirm.

- **Columns** (soft-deletable domain tables: `academic_year`, `term`, `class`, `class_teacher`, `class_seat`,
  `assignment`, `assignment_submission`): `deletedAt DateTime? @db.Timestamptz(3)`, `deletedById` (member id),
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
  third-party reads are logged with `action = export`. It holds IDs only, so it never contains student content.
- **No hard deletes in app or API code.** `DELETE` is always soft. Only dev tooling (seed, `db:reset`, test
  cleanup) hard-deletes, through the owner connection. Purge, retention windows, records holds and user
  tombstoning are future decisions.
- **Amendment requests:** handled as normal regrades/edits with a reason, not deletion.

### Follow-up: grades with no student submission

Exams and in-class work are often graded without the student uploading anything. Today a grade lives on
`assignment_submission`, which presumes a submission. The smallest extension, not built yet:

- `assignment.submission_mode`: `online` (default) or `none`.
- For `none`, grading creates the submission row at that moment, with `submitted_at` null (made nullable) and
  `graded_by_id` set; the "missing" view skips `none` assignments.

Deferred until the required API (Phase 3) is done.

### Future decisions

Intentionally not decided or built; see also the list in the README.

- **Late work:** `due_at` is stored but not enforced and nothing is flagged late. Grading implications need a
  product decision first.
- **Resubmission:** blocked by default (`max_submissions = 1`); raising the limit per assignment is allowed.
