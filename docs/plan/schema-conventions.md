# Schema conventions

The rules every model in `prisma/schema.prisma` follows. Rationale and examples live in
[data-model.md](data-model.md); this page is the checklist, and `test/schema-conventions.test.ts` enforces what it
can (marked **tested** below).

## Naming

- **Tables** are singular `snake_case` through `@@map` (`class_seat`, `storage_blob`). Domain Prisma fields and
  relations are `snake_case`, matching their database columns and the rest of the application. Better Auth's seven
  owned models remain camelCase because its adapter owns that contract. **Tested.**
- **A column that points at another row ends in `_id`** (`class_id`, `graded_by_id`, `deleted_by_id`,
  `supersedes_id`) in both Prisma and Postgres. This is the Rails convention. **Tested.**
- **The relation drops the suffix.** `graded_by_id` is the column; `graded_by` is the related member. A relation field
  never ends in `_id`. `deleted_by_id` and `uploaded_by_id` are plain columns today and can become `deleted_by` and
  `uploaded_by` relations without a rename. **Tested.**
- **Polymorphic links** use `record_type` (an enum) + `record_id` + `name`, as Active Storage does.
- **Enums** are `snake_case` types through `@@map`, with lowercase `snake_case` values. Use an enum for a closed set
  (`assignment_type`, `grading_mode`); use plain text for an open set that should not need a migration to extend
  (`activity_log.action`, `storage_blob.service_name`).
- **Calendar days** end in `_on` and are typed `@db.Date`. Instants end in `_at`.
- **Constraint and index names** are explicit where they matter: live-row uniques end `_live`
  (`class_name_live`), one-of-a-kind uniques say so (`grading_scale_one_default`), checks are named for the rule
  (`assignment_grading_mode`). Tests assert on these names.

## Keys and timestamps

- **Primary key:** `id String @id @default(uuid(7)) @db.Uuid`. **Tested.**
- **Timestamps:** every domain model has `created_at` and `updated_at`, both `@default(now())`, `updated_at` also
  `@updatedAt`, all `@db.Timestamptz(3)`. No triggers, so no raw-SQL writes in app code. **Tested.**
- **Exceptions with no `updated_at`** (append-only): `activity_log`, `submission_grade_event`. **Tested.**
- **Money-like numbers:** points `Decimal(7,2)`, percentages `Decimal(6,2)`, GPA `Decimal(3,2)`. Compare them as
  exact hundredths in code, never as floats.

## Tenancy

- **Every non-global model has `organization_id`**, NOT NULL, `@db.Uuid`. Global models: `user`, `session`,
  `account`, `verification`, `organization`. **Tested.**
- **Every domain table is a foreign-key target for its children** through `@@unique([organization_id, id])`.
- **Children reference parents with composite keys** `fields: [organization_id, parent_id], references:
[organization_id, id]`, so a row can never point at another school's parent. A band is also referenced through
  `(organization_id, grading_scale_id, id)` so it must belong to the scale it is recorded against.
- **Members, not users,** for anything inside a school (`graded_by_id`, seats, teacher links).
- Indexes that serve filters lead with `organization_id`.

## Deleting

- **Foreign keys use `onDelete: Restrict`.** Better Auth's own `member` and `invitation` keep their cascades; those
  tables are the exception. **Tested.**
- **Soft delete** columns on mutable tables: `deleted_at`, `deleted_by_id`, `deletion_reason`. Live-row
  uniqueness is a partial unique index `where: raw("deleted_at IS NULL")` (Prisma `partialIndexes` preview).
- **Append-only or immutable** tables (`activity_log`, `submission_grade_event`, `storage_blob`,
  `storage_blob_data`): `app_user` gets `INSERT` and `SELECT` only, in the migration, and the client extension
  refuses updates and deletes.
- App and API code never hard-deletes; only dev tooling does.

## Rules the schema cannot express

Prisma has no syntax for check constraints or grants, so they are appended to the migration SQL by hand: date order,
grading-mode and points consistency, grade columns all set or all empty, non-negative sizes, and the
`REVOKE UPDATE, DELETE` lines. Every one has a test in `test/database-rules.test.ts` that asserts the constraint name.

## Migrations

- **Keep the history readable start to end.** Until the first release, change the migration that introduced a table
  or column rather than adding a follow-up that renames, drops or reworks it, so no table is created in one
  migration and dropped in the next. If a change touches the generated SQL, regenerate that migration with
  `prisma migrate dev --create-only` against a database built from the earlier ones, then re-append the hand-written
  constraints and grants. Rebuild with `pnpm db:fresh` (it recreates the Docker volume so roles and grants are
  reapplied).
- Check for drift with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`.
- Better Auth's tables are hand-maintained. Re-running its generator overwrites these conventions, so generate to a
  scratch file and diff instead.

## Adding a model

1. UUIDv7 `id`, `organization_id`, `created_at`, `updated_at`, `@@map` to a singular snake_case table.
2. `@@unique([organization_id, id])`, and composite relations to each parent with `onDelete: Restrict`.
3. Name pointer fields `…_id` and the relations without the suffix.
4. Add soft-delete columns and a live-row unique if people can delete it; add it to `SOFT_DELETABLE` in
   `lib/server/db-extensions.ts`.
5. Append check constraints and any grants to the migration, then add a database-rule test for each.
6. Run `pnpm test`: the convention tests fail on anything missed.
