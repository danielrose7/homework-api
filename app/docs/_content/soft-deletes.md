Nothing in this API is removed from the database by app or API code. A delete marks the row, reads skip marked rows,
and the client refuses the hard-delete calls. The enforcement lives in one file:
[`lib/server/db-extensions.ts`](https://github.com/danielrose7/homework-api/blob/main/lib/server/db-extensions.ts).

## What a soft delete is

Every soft-deletable table carries three columns:

| Column            | Holds                                   |
| ----------------- | --------------------------------------- |
| `deleted_at`      | When the row was deleted; `null` = live |
| `deleted_by_id`   | The member who deleted it               |
| `deletion_reason` | Why, in the member's words              |

The tables are listed in the `SOFT_DELETABLE` set at the top of the extension: academic years, terms, grading scales
and their bands, classes, class teachers and seats, assignments, submissions and storage attachments.

## How reads hide deleted rows

[`lib/server/db.ts`](https://github.com/danielrose7/homework-api/blob/main/lib/server/db.ts) builds the one Prisma
client the app uses and extends it with two extensions from `db-extensions.ts`.

`hideSoftDeleted` wraps `findMany`, `findFirst`, `findFirstOrThrow`, `findUnique`, `findUniqueOrThrow` and `count`.
For a soft-deletable model it adds `deleted_at: null` to the `where`, so a query like
`assignment.findMany({ where: { class_id } })` never returns a deleted assignment and a lookup by the id of a deleted
row behaves as not found. Queries and mutations do not repeat the filter.

It also wraps `delete` and `deleteMany`. On a soft-deletable model they throw ("rows are soft-deleted, never
removed") instead of running, so a hard delete cannot slip in through the client.

`appendOnly` is the sibling guard for tables that must never change: `activity_log`, `submission_grade_event` and the
storage blob tables. It refuses `update`, `updateMany`, `upsert`, `delete` and `deleteMany` on them.

## What the extension does not cover

- **Nested relations.** `include` and `select` on a relation are not filtered, so a query that loads children must ask
  for live ones itself, as
  [`load-grading-scale.ts`](https://github.com/danielrose7/homework-api/blob/main/modules/grading-scales/queries/load-grading-scale.ts)
  does for bands with `where: { deleted_at: null }`. A test pins this behavior down so it cannot change by accident.
- **Raw SQL.** It bypasses the client entirely. App code does not write raw SQL, and the tests use it only to check
  that a hidden row is still in the table.
- **Dev tooling.** The seed, the sandbox reset and test cleanup hard-delete through the owner connection, which is
  not extended.

## Reusing a name

A deleted row must not block its name. Natural-key unique constraints are partial indexes
(`UNIQUE … WHERE deleted_at IS NULL`), written in the
[migration](https://github.com/danielrose7/homework-api/blob/main/prisma/migrations/20261004192716_domain_model/migration.sql)
because Prisma cannot express them. A class named "Algebra" can be deleted and created again.

## Where it is tested

[`test/database-rules.test.ts`](https://github.com/danielrose7/homework-api/blob/main/test/database-rules.test.ts)
covers the rules above: deleted rows are hidden from top-level reads but stay in the table, hard deletes through the
client are refused, nested includes are not filtered, names can be reused, and append-only tables reject writes.

## What is not built yet

The `DELETE` and restore endpoints are deferred (see [What is deferred](/docs/architecture/deferred)), so today rows
are soft-deleted by the seed and the tests. The read side, the guards and the schema are in place, so the endpoints
only need to set the three columns and the existing extension does the rest.
