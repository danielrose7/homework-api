# Future ideas

Deferred on purpose. Each entry says what it is, what we already prepared, and what enabling it would take.
"No migration" means the schema already has what it needs.

## Extra credit

Out of scope; nothing in the schema or API is reserved for it. Common patterns in other gradebooks: Canvas lets a
score exceed the points possible or uses a zero-point assignment; Schoology and Blackboard use zero-point items;
Brightspace has an opt-in "Can exceed" setting and explicit bonus items, plus category and overall caps.

- **Today:** grading rejects points above `max_points` (a validator rule, not a database constraint), the top grade
  band is open-ended, and every grade event snapshots `max_points`, so adding extra credit later would not rewrite
  history.
- **Score above the maximum on a normal assignment:** add a nullable per-assignment cap column (null meaning
  `max_points`) in a new migration, then let the grade validator allow points up to it.
- **Bonus items:** needs class averages (below): a bonus assignment adds to the numerator only and skips its own
  letter grade. Avoid the zero-point-assignment trick, which divides by zero.
- **Class or overall caps** arrive with averages, because averages need new tables anyway.

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

## Rate limits

Nothing limits request volume today. A sign-in endpoint that accepts unlimited password guesses and a submit route
that buffers up to five 5 MB files per request are the two obvious targets.

- **Already prepared:** every `/api/v1` request passes through `serve`, so one limiter there covers all routes. The
  request context already carries the user, member, school and IP, and each route is a `defineRoute` definition that
  could name its own limit class. Responses already carry `x-request-id`, and errors already have one shape.
- **What it would take:** a limiter keyed by member (falling back to IP for unauthenticated calls), with tighter
  limits for writes and uploads than for reads; a `429` that uses the shared error shape plus `Retry-After`
  (`STATUS` gains `too_many_requests`); and standard `RateLimit` headers so Python and Node clients can back off.
- **Storage:** an in-memory counter is enough for one process and fine for a demo. Several instances need a shared
  store, such as Postgres or Redis, or the limit moves to the platform edge (a WAF rule) instead of the app.
- **Sign-in:** Better Auth ships its own rate limiter for `/api/auth/*`. Before relying on it, check its defaults
  and storage, because they differ between development and production. Lockout after repeated failures is a
  separate product decision.
- **Open questions:** whether a school gets a shared budget on top of the per-member one, and whether a `429` is
  logged (it is not an authorization denial, so it would not use the denied row today).

## Row-level security

Schema is RLS-ready (see [auth-and-tenancy.md](auth-and-tenancy.md)); enabling it is writing policies, a
per-request context, and a leak test.

## Tamper-evident audit log

A per-school `prev_hash` / `row_hash` chain on `activity_log`, possible because the table is strictly append-only.

## Presigned uploads to R2/S3

The Active Storage-style tables already allow it: `storage_blob.service_name` picks the storage service. Enabling it
means a new `StorageService` that signs `PUT`/`GET` URLs, a `POST /uploads` endpoint that creates an unattached blob
and returns the upload URL (Rails calls this a direct upload), a job to clear blobs that never get attached, private
buckets with short-lived signed reads, and object keys that carry no personal data. A one-off copy moves existing
bytes out of `storage_blob_data` and flips `service_name`. Mockable with an in-memory service for demos. Virus
scanning belongs here too.
