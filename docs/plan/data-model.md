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

| Table                                             | Key columns / notes                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification`      | Better Auth (username + password sign-in; email required but contact-only)                                                                                                                                                                                                                                |
| `organization` (= school), `member`, `invitation` | Better Auth org plugin. Roles: `administrator`, `teacher`, `student` (+ `owner`)                                                                                                                                                                                                                          |
| `academic_year`                                   | org, name, start/end dates                                                                                                                                                                                                                                                                                |
| `term`                                            | org, academic_year, name, start/end; no overlap within a year                                                                                                                                                                                                                                             |
| `grading_scale`                                   | org, name, `is_default`, optional `supersedes_id`; one default per school; see Grading scales                                                                                                                                                                                                             |
| `grading_scale_band`                              | org, scale, `label`, `group_label`, `min_percent`, `gpa_points`, `is_passing`, `sort_order`                                                                                                                                                                                                               |
| `class`                                           | org, term, name, optional `grading_scale_id` override                                                                                                                                                                                                                                                     |
| `class_teacher`                                   | org, class, teacher member (role must be teacher)                                                                                                                                                                                                                                                         |
| `class_seat`                                      | org, class, student member (role must be student), `status` (`active`/`dropped`), `dropped_at`                                                                                                                                                                                                            |
| `assignment`                                      | org, class, title, `type` enum (`homework`, `exam`, `project`, …), `grading_mode` (`points`/`band`), `max_points` (null in `band` mode), optional `grading_scale_id` override, reserved `score_cap_points` and `is_bonus` (see Reserved columns), `due_at`, `max_submissions` (default 1), `published_at` |
| `assignment_submission`                           | org, assignment, `class_seat_id`, `attempt_number`, `content`, `submitted_at`, **current grade**: `points_awarded` (null in `band` mode), `grading_scale_id`, `grade_band_id`, `grade_label`, `grade_group`, `teacher_notes`, `graded_at`, `graded_by`                                                    |
| `submission_attachment`                           | org, submission, `original_filename`, `content_type`, `byte_size`, `sha256`, `storage_backend` (`database`/`object_store`), `storage_key` (null for `database`), `content` bytea (null for `object_store`); immutable once created; soft-deletable                                                        |
| `submission_grade_event`                          | append-only grade history — see audit-and-grade-history.md                                                                                                                                                                                                                                                |
| `activity_log`                                    | append-only audit log — see audit-and-grade-history.md                                                                                                                                                                                                                                                    |

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
  open-ended so extra credit above 100% still resolves.
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

## Submission contents and attachments

A submission is text, files, or both. Options considered:

1. **`multipart/form-data` on the submit endpoint.** One request, easy `curl -F`, Python and Node examples. Files are
   stored in Postgres (`bytea`), so the submission and its files commit in one transaction and the over-submission
   guard covers them. Costs: database size, and request-body limits on some hosts (Vercel caps bodies at 4.5 MB).
2. **Presigned upload to R2/S3.** `POST /uploads` returns a presigned `PUT` URL and an attachment id; the client
   uploads straight to the bucket, then the submission references the ids. Right for production and large files.
   Costs: a two-step flow, orphaned uploads to clean up, and a bucket (mockable for this take-home).
3. **Seeded blobs in the database** for the demo: small fixture files inserted by the seed script.

**Proposed (decide at the Phase 2/3 gate):** model `submission_attachment` now, independent of where bytes live
(`storage_backend` plus `storage_key` or `content`), behind a small `AttachmentStore` interface.

- Phase 3 implements the `database` backend with `multipart/form-data` (and plain JSON for text-only). Seeds and
  tests use the same backend, so the demo needs no external service.
- The `object_store` backend and the presigned-URL flow are documented in future-ideas.md and can be mocked;
  enabling them needs no migration.
- Rules for the validators (`422`): at least text or one file; per-file size cap (default 5 MB), file-count cap,
  allowed content types, non-empty files, filename sanitized (no paths), checksum computed server-side.
- Attachments are immutable. A change is a new attempt where `max_submissions` allows it.
- Downloads are `GET …/submissions/{id}/attachments/{attachmentId}`, streamed with `Content-Disposition: attachment`
  and `X-Content-Type-Options: nosniff`, and logged as a `read` in the activity log (a FERPA access record). List
  queries never select `content`.
- Soft-deleting a submission hides its attachments; object-store keys are retained (retention is indefinite).

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
  `graded_by` set; the "missing" view skips `none` assignments.

Deferred until the required API (Phase 3) is done.

### Reserved columns for extra credit

Extra credit is blocked for now (see [future-ideas.md](future-ideas.md)), but its columns exist so enabling it
needs no migration:

- `assignment.score_cap_points numeric(7,2) null`: highest allowed score; null means `max_points`.
- `assignment.is_bonus boolean not null default false`: the assignment adds to a student's points without adding
  to what is possible.
- No database check ties `points_awarded` to `max_points`; that bound lives only in `validate*`, and grade events
  snapshot `max_points`, so any grade can be recomputed later.
- The API **rejects** any non-default value for these two fields (`422`, code `reserved_field`) and never returns
  them as writable. A guard test fails if either is ever set outside tests that exercise the future feature.

### Future decisions

Intentionally not decided or built; see also the list in the README.

- **Late work:** `due_at` is stored but not enforced and nothing is flagged late. Grading implications need a
  product decision first.
- **Resubmission:** blocked by default (`max_submissions = 1`); raising the limit per assignment is allowed.
