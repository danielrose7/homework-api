**Plain REST, documented from the code.** Each route's Zod schemas validate the request _and_ feed the field tables
in the API reference, so the docs cannot drift from the handler. There is no OpenAPI file. The registry is
[`app/docs/_lib/registry.ts`](https://github.com/danielrose7/homework-api/blob/main/app/docs/_lib/registry.ts), and a test
fails if a route has no entry.

**Two layers of validation.** Zod checks the shape at the route boundary; `validate*` functions in
[`lib/domain`](https://github.com/danielrose7/homework-api/tree/main/lib/domain) check rules that depend on other
fields or data, such as a grade against the assignment's points. Both answer `422` with every problem listed.
`409` is reserved for a valid request that the current state refuses.

**Grading scales are data.** A scale and its bands are tables, so a school can use letters, plus/minus or
pass/fail. The grade is looked up by
[`lib/domain/grading.ts`](https://github.com/danielrose7/homework-api/blob/main/lib/domain/grading.ts) and
snapshotted on the submission when graded, so changing a scale never relabels past grades.

**Schools are the tenant.** Every query takes a
[`RequestContext`](https://github.com/danielrose7/homework-api/blob/main/lib/server/context.ts) and filters by
`organization_id`; another school's records answer `404`. Row-level security is out of scope, but the schema is ready
for it. A [test](https://github.com/danielrose7/homework-api/blob/main/test/tenant-isolation.test.ts) walks every
route as a member of a different school.

**Nothing is hard-deleted.** Deletes are soft (`deleted_at`, who, and why), and an audit log records reads, grades
and denials by id only, never by content. See [Soft deletes](/docs/architecture/soft-deletes) for how the client
enforces it.

**Submissions are race-safe.** Two parallel submits for a one-submission assignment give one `201` and one `409`,
enforced by a unique attempt number and a retry, and proven in the
[race tests](https://github.com/danielrose7/homework-api/blob/main/test/race/submit.race.test.ts).

**Files live in Postgres for now**, behind a storage service shaped like Rails' Active Storage, so moving to S3 or R2
later needs no schema change. See
[`lib/server/storage`](https://github.com/danielrose7/homework-api/tree/main/lib/server/storage).
