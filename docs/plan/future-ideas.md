# Future ideas

Deferred on purpose. Each entry says what it is, what we already prepared, and what enabling it would take.
"No migration" means the schema already has what it needs.

## Extra credit

**Blocked for now.** Common patterns in other gradebooks: Canvas lets a score exceed the points possible or uses
a zero-point assignment; Schoology and Blackboard use zero-point items; Brightspace has opt-in "Can exceed" and
explicit bonus items, plus category and overall caps.

- **Prepared (no migration):** `assignment.score_cap_points` (null = `max_points`) and `assignment.is_bonus`
  (default false), both rejected by the API today; no DB check on `points_awarded <= max_points`; open-ended top
  band so scores above 100% resolve; `max_points` snapshotted in every grade event.
- **Enabling "score above max":** allow `points` up to `score_cap_points` in the grade validator and accept the
  field on assignment create/update. No schema change.
- **Enabling bonus items:** needs class averages (below). A bonus assignment adds to the numerator only and skips
  its own letter grade. Avoid the zero-point-assignment trick, which divides by zero.
- **Class or overall caps** (`class.max_final_percent` or similar) arrive with averages, because averages need new
  tables anyway.

## Late work

`due_at` is stored but not enforced and nothing is flagged late. Options: block, accept and flag (`is_late`
derived from `submitted_at` against `due_at`), or apply a penalty. Grading implications need a product decision.

## Retention and purge

Retention is indefinite. A future policy could add per-school retention windows, a logged admin purge job, records
holds for open FERPA requests, and tombstoning users (scrub personal data, keep ids). Today only dev tooling
hard-deletes.

## Graded work with no student upload

Exams and in-class work. Add `assignment.submission_mode` (`online` default, `none`) and make
`assignment_submission.submitted_at` nullable; grading then creates the row, and the "missing" view skips `none`
assignments.

## Excused work and Incomplete deadlines

Canvas and Google Classroom support excused work (left out of totals). A manual-only "Excused" band with
`counts_in_average = false` would fit the existing band model. An Incomplete could convert to a failing grade after
a deadline, which needs a nullable resolve-by date and a scheduled job.

## Class averages and weighting

Averages over `points`-graded work, optional category weights, and the extra-credit rules above. `band`-graded
(pass/fail) work has no percentage and is excluded.

## Row-level security

Schema is RLS-ready (see [auth-and-tenancy.md](auth-and-tenancy.md)); enabling it is writing policies, a
per-request context, and a leak test.

## Tamper-evident audit log

A per-school `prev_hash` / `row_hash` chain on `activity_log`, possible because the table is strictly append-only.
