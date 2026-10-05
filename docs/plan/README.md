# Homework API — Plan

Take-home for Stride, a startup building a system of record for PT practices (assignment PDF:
`../../project_overview.pdf`). Spec says Python; the hiring
manager explicitly OK'd any language/framework. Suggested effort: 3–4 hours; we are going deeper on
purpose. Be ready to discuss, defend and extend every part.

This directory is the living plan. Update it as we go (tick boxes, add to the decision log).

| Doc                                                      | Contents                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| [schema-conventions.md](schema-conventions.md)           | Naming, keys, timestamps, tenancy, deletes: the rules every model follows |
| [data-model.md](data-model.md)                           | Tables, conventions (UUIDv7, timestamps, org scoping), grading rules      |
| [auth-and-tenancy.md](auth-and-tenancy.md)               | Better Auth, roles, request context, DB roles, RLS-ready schema rules     |
| [sandbox-and-seed.md](sandbox-and-seed.md)               | Seed data, reset button, dev-style UI                                     |
| [audit-and-grade-history.md](audit-and-grade-history.md) | HIPAA-style `activity_log`, grade events, regrade concurrency             |
| [future-ideas.md](future-ideas.md)                       | Deferred features, options considered, and what is already prepared       |
| [testing.md](testing.md)                                 | Rollback-per-test, Fishery, guard tests, race tests                       |
| [api-and-docs.md](api-and-docs.md)                       | REST design, docs page, tabbed examples, UI                               |

## Assignment requirements → where they land

- Students: submit homework; list own submissions; filter by grade (A–F, incomplete, ungraded) and assignment name.
- Teachers: overview of all submissions; filter by assignment name, date range (from–to), student name; grade a submission (A–F + comments).
- Homework object fields: assignment, student, submission date, grading date, final grade, **teacher notes** (`teacher_notes`).
- Unit tests for business logic. Documented endpoints. Code pushed to git ≥24h before review.

## Stack

Next.js (App Router) + TypeScript, Postgres, **Prisma**, **Better Auth** (self-hosted; organization, bearer and
API key plugins), shadcn/ui, Vitest + Fishery, pnpm (matches `../goji-health`).

## Decision log

| Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status  | Notes                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js + Prisma + Postgres + Better Auth (self-hosted)                                                                                                                                                                                                                                                                                                                                                                                                           | Decided |                                                                                                                                                  |
| REST route handlers, documented by a Zod-driven route registry on an in-app docs page; **no tRPC, no OpenAPI**                                                                                                                                                                                                                                                                                                                                                    | Decided | tRPC can't be called cleanly from Python/curl. Standard verbs: GET / POST / PUT / PATCH / DELETE                                                 |
| Soft deletes (`deleted_at`/`deleted_by_id`/`deletion_reason`); app and API code never hard-delete                                                                                                                                                                                                                                                                                                                                                                 | Decided | Only dev tooling (seed, reset, test cleanup) hard-deletes, via the owner connection                                                              |
| Retention is indefinite; no purge feature                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided | FERPA-supportive; purge and retention windows are future decisions                                                                               |
| "Incomplete" is a manual-only, neutral grade band (not a status, not null); `ungraded` = no band                                                                                                                                                                                                                                                                                                                                                                  | Decided | Matches the brief's grade list; no `status` column                                                                                               |
| Two-layer validation: Zod at the boundary, `validate*` functions for meaning; both return `422` with all field issues                                                                                                                                                                                                                                                                                                                                             | Decided | `409` is for state conflicts; see api-and-docs.md                                                                                                |
| Extra credit is out of scope; nothing is reserved for it in the schema                                                                                                                                                                                                                                                                                                                                                                                            | Decided | Deferred work: see future-ideas.md                                                                                                               |
| Submission files use an Active Storage-style model: `storage_blob`, `storage_blob_data`, `storage_attachment`; bytes in Postgres for now, selected by `service_name`                                                                                                                                                                                                                                                                                              | Decided | Presigned R2/S3 later without a schema change; see data-model.md                                                                                 |
| Resubmission blocked by default (`max_submissions = 1`)                                                                                                                                                                                                                                                                                                                                                                                                           | Decided |                                                                                                                                                  |
| Cross-school requests return `404`; `403` only for in-school role failures                                                                                                                                                                                                                                                                                                                                                                                        | Decided |                                                                                                                                                  |
| Late work is not enforced or flagged yet                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided | Future decision: grading implications                                                                                                            |
| No ETag or `If-Match`; a regrade is last-write-wins, with a required `reason` and a full grade history                                                                                                                                                                                                                                                                                                                                                            | Decided | Replaces the stale-grade check; optimistic concurrency is in future-ideas.md                                                                     |
| API shape follows Django/Rails conventions, and Stripe where those are silent: an `object` field on resources, Stripe list objects, `type` on errors                                                                                                                                                                                                                                                                                                              | Decided | ISO 8601 timestamps stay; `PUT …/grade` stays; see api-and-docs.md                                                                               |
| Lists answer `{ object: "list", url, has_more, data }`; page with `limit` (default 25, max 100) and `starting_after=<id>`                                                                                                                                                                                                                                                                                                                                         | Decided | Replaces the opaque `cursor`/`next_cursor` and `page_size`                                                                                       |
| `class_enrollment` renamed `class_seat`                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided |                                                                                                                                                  |
| `feedback` renamed `teacher_notes`                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided | Matches the spec wording                                                                                                                         |
| Timestamps (not revision numbers) for grade history + concurrency                                                                                                                                                                                                                                                                                                                                                                                                 | Decided | `Timestamptz(3)` everywhere to avoid ms/µs mismatch                                                                                              |
| `created_at`/`updated_at` both `@default(now())`; `updated_at` also `@updatedAt`; **no DB trigger**                                                                                                                                                                                                                                                                                                                                                               | Decided | DB default covers inserts; client sets updates. Raw SQL updates bypass `updated_at`, so we ban raw writes outside migrations                     |
| Append-only tables enforced by role grants + Prisma extension, **no DB trigger**                                                                                                                                                                                                                                                                                                                                                                                  | Decided |                                                                                                                                                  |
| Grading scales are table-driven (`grading_scale` + `grading_scale_band`), with a school default and class/assignment overrides                                                                                                                                                                                                                                                                                                                                    | Decided | Supports +/- letters and pass/fail                                                                                                               |
| Assignments have a `grading_mode`: `points` (scale lookup) or `band` (teacher picks a band such as Pass, Fail or Incomplete directly, no points)                                                                                                                                                                                                                                                                                                                  | Decided | Pass/fail with no points needs nullable points and `max_points`; check constraints keep rows consistent                                          |
| The graded result (band, label, group) is snapshotted on the submission and grade event; scales are immutable once used                                                                                                                                                                                                                                                                                                                                           | Decided | Reverses "letter never stored": editable scales would otherwise relabel past grades                                                              |
| Sign-in is username + password (username plugin); email is required by Better Auth but contact-only                                                                                                                                                                                                                                                                                                                                                               | Decided | Usernames globally unique; `/sign-in/email` disabled                                                                                             |
| The remaining Phase 4 endpoints are deferred; seed-only creation of people, classes, assignments and scales is enough for the brief                                                                                                                                                                                                                                                                                                                               | Decided | Listed in future-ideas.md. The unused service code for them was deleted; git history has it                                                      |
| `modules/demo` became `app/sandbox/_server`, and "demo" became "sandbox" everywhere (`SANDBOX_MODE`, `SANDBOX_PASSWORD`, `resetSandboxData`)                                                                                                                                                                                                                                                                                                                      | Decided | Sandbox-only code lives with the sandbox so it is not mistaken for application modules                                                           |
| Work in small reviewable commits (verb-first title + short narrative body)                                                                                                                                                                                                                                                                                                                                                                                        | Decided | See `AGENTS.md`                                                                                                                                  |
| Organize application behavior into domain modules with `queries`, `mutations` and Django-style serializers; keep HTTP contracts in their `app/api` route files                                                                                                                                                                                                                                                                                                    | Decided | Migrate module by module; see `docs/architecture.md`                                                                                             |
| Use `snake_case` for domain data across Prisma, module inputs/results, route/Zod contracts, serializers and audit metadata; Better Auth stays camelCase                                                                                                                                                                                                                                                                                                           | Decided | Better Auth's adapter owns its model contract; third-party API option names also remain unchanged                                                |
| Fully typed, `tsc --noEmit` as we go; boilerplate Prettier                                                                                                                                                                                                                                                                                                                                                                                                        | Decided |                                                                                                                                                  |
| Pointer columns end in `_id` and the Prisma relation drops the suffix (`graded_by_id` / `graded_by`)                                                                                                                                                                                                                                                                                                                                                              | Decided | Enforced by `test/schema-conventions.test.ts`; see schema-conventions.md                                                                         |
| Migration history stays clean start to end: edit the migration that introduced a thing, never rework it in a follow-up (pre-release); rebuild with `pnpm db:fresh`                                                                                                                                                                                                                                                                                                | Decided | See schema-conventions.md                                                                                                                        |
| `pnpm db:setup` is the one setup command: creates `.env.local` from `.env.example` if no env file exists, starts Docker, applies `scripts/roles.sql` as superuser (idempotent), migrates, generates and seeds when `SANDBOX_MODE=true` and the DB is empty; `db:fresh` is `down -v` plus `db:setup`                                                                                                                                                               | Decided | Replaces the Docker `initdb.d` mount; named `db:setup` because `pnpm setup` is a pnpm builtin                                                    |
| Production runs on Neon (Vercel Marketplace). `vercel-build` is `prisma generate`, `next build`, then `prisma migrate deploy`, so migrations run at the end of the build. Roles are applied once with `pnpm db:roles` (random passwords outside localhost, printed as the `app_user`/`app_owner` URLs); `db:setup` reuses the same code with the dev passwords. `lib/server/db.ts` uses `@prisma/adapter-neon` for `*.neon.tech` hosts and `adapter-pg` elsewhere | Decided | Managed Postgres cannot take the hardcoded dev passwords or `ALTER DATABASE homework`; Prisma Postgres could not create roles                    |
| Tests may not import the app-wide `auth` or `prisma` singletons (ESLint rule)                                                                                                                                                                                                                                                                                                                                                                                     | Decided | They commit outside the test transaction; see testing.md                                                                                         |
| RLS is **out of scope**; the schema is RLS-ready (`organization_id` almost everywhere, composite FKs)                                                                                                                                                                                                                                                                                                                                                             | Decided | Isolation is enforced in the service layer; see auth-and-tenancy.md appendix                                                                     |
| The sandbox school is named "Sandbox" (slug `sandbox`), in the seed and in all docs examples                                                                                                                                                                                                                                                                                                                                                                      | Decided | Slug is reserved                                                                                                                                 |
| UI is dev/API-flavored, monospace, demo-friendly, with a seed script and a reset button                                                                                                                                                                                                                                                                                                                                                                           | Decided | See sandbox-and-seed.md                                                                                                                          |
| Fishery factories persist in `onCreate`; traits agreed together before writing                                                                                                                                                                                                                                                                                                                                                                                    | Decided | See testing.md                                                                                                                                   |
| Route tests build context through setup helpers                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided | See testing.md                                                                                                                                   |
| Sandbox seed data is separate from CI factories                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided | Deterministic, readable names; see sandbox-and-seed.md                                                                                           |
| Grading uses one permission, `grade: update`, for teachers and administrators; `grade: create` is removed                                                                                                                                                                                                                                                                                                                                                         | Decided | Phase 3 applies it in `lib/server/permissions.ts`                                                                                                |
| No member-provisioning or invitation endpoints; people are created by the seed script. The API covers what the PDF brief needs, give or take                                                                                                                                                                                                                                                                                                                      | Decided | Better Auth's own routes stay mounted for sign-in and school creation                                                                            |
| JSON fields use `snake_case` (`teacher_notes`, `submitted_at`)                                                                                                                                                                                                                                                                                                                                                                                                    | Decided | Matches the brief and Python clients                                                                                                             |
| Submit takes JSON `{ "text" }` or multipart (`text` plus repeated `files`); attachments cannot be added after submitting                                                                                                                                                                                                                                                                                                                                          | Decided |                                                                                                                                                  |
| Any JSON stored in the database is `JSONB` (Prisma `Json`)                                                                                                                                                                                                                                                                                                                                                                                                        | Decided | `storage_blob.metadata` and `activity_log.metadata` already are                                                                                  |
| Each school has a time zone in a new `organization_preferences` table; date filters and date-only inputs are read in it, not UTC                                                                                                                                                                                                                                                                                                                                  | Decided | Timestamps in responses stay ISO 8601 with an offset; see api-and-docs.md                                                                        |
| The seed creates people through Better Auth sign-up, with one shared dev password (`sandbox-dev`)                                                                                                                                                                                                                                                                                                                                                                 | Decided | Phase 4 decision 8; passwords hash the way sign-in expects                                                                                       |
| `pnpm db:seed` refuses a database that has data; `pnpm db:reset` truncates every table (auth included) through the owner connection and re-seeds                                                                                                                                                                                                                                                                                                                  | Decided | Phase 4 decisions 6 and 9. The UI reset button asks for confirmation first                                                                       |
| Each route's docs entry lives on its `defineRoute` (`doc`), beside the Zod schemas the handler parses with; `app/docs/_lib/registry.ts` lists the routes and a test fails if one is missing                                                                                                                                                                                                                                                                       | Decided | The schemas feed the field tables, so docs cannot drift; the sandbox console reads the same registry                                             |
| One example definition per request generates the curl, Python (`requests`) and Node (`fetch`) tabs; they read `HOST`, `TOKEN` and ids from environment variables                                                                                                                                                                                                                                                                                                  | Decided | `test/docs-examples.test.ts` runs each against the seeded Sandbox school; the snippet test runs all three languages against an echo server       |
| The docs page renders its Markdown with `react-markdown` + `remark-gfm`                                                                                                                                                                                                                                                                                                                                                                                           | Decided | Prose lives in `app/docs/_content/*.md`; JSON samples in it are compared with real responses by a test                                           |
| Docs become a multi-page site (Cloudflare-style: tree nav, per-endpoint pages, guides) styled like the sandbox, with a webfont pairing instead of system fonts                                                                                                                                                                                                                                                                                                    | Decided | Folded into Phase 7; prose is small Markdown files plus a nav manifest, rendered by a catch-all route with the existing `react-markdown`. No MDX |
| Docs code lives in `app/docs/_lib`; the `RouteDoc` type stays in `lib/server` so infrastructure never imports from `app/`                                                                                                                                                                                                                                                                                                                                         | Decided | Registry, examples, snippets and fields moved with their tests                                                                                   |
| Docs and sandbox cross-link (endpoint page to console and back, persona deep links); `/` becomes a real homepage                                                                                                                                                                                                                                                                                                                                                  | Decided | Sandbox links only show when `SANDBOX_MODE=true`                                                                                                 |
| The README leads with the live URL, then covers requirements (Node 22.12+, pnpm 11.25, Docker), local run, tests and a setup prompt for a coding agent; it links to the docs and plan for decisions and deferred work                                                                                                                                                                                                                                             | Decided | Node floor comes from Prisma 7 and Vitest 5; the live site runs with `SANDBOX_MODE` off, so the sandbox is local-only                            |
| UI authenticates with a Bearer token kept in memory and `sessionStorage`; screens are console, app, brief checks, and a data view behind `SANDBOX_MODE`                                                                                                                                                                                                                                                                                                           | Decided | Phase 6 decisions 1 and 3; the data view reads tables through a dev-only route                                                                   |

## Deviations from the plan

Recorded as work lands; each is small but worth a look at the gate.

- Better Auth tables stay in the `public` schema. A separate `auth` schema needs Prisma multi-schema support and
  only mattered for RLS, which is out of scope.
- Better Auth tables keep `ON DELETE CASCADE` to their parents (they are Better Auth's own and the API never
  deletes users or schools). Our domain tables will use `RESTRICT`.
- Tests use a separate `homework_test` database created by Vitest global setup, and test files run serially.
- `package.json` sets `"type": "module"`.
- Partial unique indexes use Prisma's `partialIndexes` preview feature (7.4+), so they live in `schema.prisma`
  and migrate cleanly. Check constraints and the grants still live in hand-written migration SQL.
- `deleted_by_id` is a plain uuid column on every soft-deletable table, not a foreign key (an audit pointer, like
  the activity log). `graded_by_id` is a real composite foreign key to the member. Becoming relations is deferred with the delete endpoints.
- Submission attempt numbers must be allocated as `max(attempt_number) + 1` over all rows including soft-deleted
  ones, while the limit counts only live rows, because the attempt number is unique unconditionally.
- Top-level reads hide soft-deleted rows; an administrator restore flow needs an unfiltered read path, to be
  added with the restore endpoints, which are deferred.
- Parallel submits are serialized by the unique attempt number: the loser's transaction aborts, `submitAssignment`
  runs it again (up to 5 times), and the second pass answers `409 submission_limit_reached` or takes the next free
  attempt. The race tests run in their own database, `homework_race`, because they commit.
- Denials are logged for school members only: `403`s and the deliberate `404` refusals. A request from a
  non-member, an unauthenticated one, or one for a missing id leaves no `denied` row.
- `GET /submissions/{id}` was not in the route plan. It was added because submit returns a `Location` pointing at it
  and because a client needs to read one record after a write; reading it is a logged single-record read.
- All sandbox UI and dev-only routes live under `/sandbox`, as server and client components co-located in
  `app/sandbox` (private `_components`, `_lib` and `_server` folders). The reset endpoint is `POST /sandbox/api/reset`, not
  `/api/v1/dev/reset`, so nothing sandbox-specific sits in the public API namespace. The whole segment answers `404`
  unless `SANDBOX_MODE=true`. The seed and reset logic stay in `app/sandbox/_server` because the CLI scripts share them.
- The docs page is at `/docs` (public, outside `/sandbox`) and imports the route modules, so building needs the same
  environment variables as running. There is no assignment-listing endpoint, so the examples read assignment ids from
  an `ASSIGNMENT_ID` variable; the sandbox console and `/sandbox/api/options` list them.
- The plan named an API key plugin for Better Auth; only the bearer plugin is installed, so the docs describe
  bearer tokens only.
- No `Idempotency-Key` on submit; the attempt limit already makes a repeated request a `409`.

## Phases

Each phase ends with passing tests. Tick as we go.

### Phase 1 — Foundation

- [x] `git init`, `AGENTS.md`
- [x] pnpm, Next.js, strict TypeScript + `typecheck` script, Prettier
- [x] shadcn init
- [x] `docker-compose` Postgres; env handling
- [x] Prisma setup; two connection strings (`DATABASE_URL` app role, migration URL owner)
- [x] Better Auth: username+password (username plugin), organization plugin (custom roles), bearer plugin, UUIDv7 ids
- [x] Shared timestamp conventions; schema guard test (every domain model has `created_at` + `@updatedAt` unless allowlisted)
- [x] `RequestContext` type and member/role guard helpers
- [x] Vitest + rollback-per-test Prisma client
- [x] Fishery factories for user, organization, member (traits agreed first; persistence in `onCreate`); domain factories arrive with their tables in Phase 2
- [x] Baseline scenario helpers: `seedSchool()` returns signed-in personas (call it twice for an `other` school); later phases layer term, class and assignment on top
- **Done when:** a test signs up a user, creates an org, checks a role, and rolls back cleanly.

### Phase 2 — Data model and domain logic

- [x] Full schema + migrations (see data-model.md), composite org FKs, `RESTRICT`
- [x] DB roles (created by `scripts/roles.sql`, applied by `pnpm db:setup`, since roles are cluster-level) and a grants migration: the append-only and immutable tables are narrowed to `INSERT`/`SELECT` for `app_user`
- [x] `submission_grade_event`, `activity_log`, `recordActivity`, append-only extension
- [x] Soft-delete columns, Prisma read filter, partial unique indexes
- [x] Grading scale + band tables, school default created on org creation, scale resolution
- [x] `grading_mode` on assignments, nullable points, check constraints (hand-written SQL)
- [x] Pure functions: points→grade band lookup, scale validation, term overlap, submission eligibility, grade request validation
- [x] Service layer with org + role guards: grading scales, academic structure, assignments, grading
- [x] Domain factories and layered seed helpers (`seedClass`, `seedAssignment`, `seedSubmission`)
- **Done when:** unit tests cover band boundaries across scale types, scoping, permissions.

### Phase 3 — Required API (the assignment)

**Decisions** (recorded in the decision log):

1. `grade: create` is removed; grading is one `grade: update`.
2. No member endpoints; the seed script creates people. Only the routes the PDF brief needs.
3. JSON fields are `snake_case`.
4. Submit is JSON `{ "text" }` or multipart (`text` plus repeated `files`); no attachments after submitting.
5. List filters: `from`/`to` are inclusive dates read in the school's time zone (`organization_preferences`), not
   UTC; `assignment` and `student` are case-insensitive "contains" (student matches display name or username,
   minimum two characters); newest first; page size 25, maximum 100. A school's time zone defaults to
   `America/New_York`.

- [x] `organization_preferences` (one row per school, IANA `timezone`, default `America/New_York`), created with the
      school and with the default scale; edit the domain migration in place and rebuild with `pnpm db:fresh`

- [x] Route plumbing: mount Better Auth's HTTP handler (`/api/auth/*`) so curl, Python and Node can sign up, sign in
      for a Bearer token and create a school; a small route wrapper that builds the `RequestContext`, parses with Zod and
      turns `ApiError` into the shared JSON error shape
- [x] Student: submit as JSON (text) or `multipart/form-data` (files, using `createBlob` + `attachBlobToSubmission` and
      `submissionEligibility` in one transaction); list own submissions (grade / assignment-name filters)
- [x] Attachments: list and download routes (downloads are logged reads)
- [x] Teacher: overview (assignment, date range, student-name filters), scoped to the classes a teacher teaches
- [x] Teacher: grade route `PUT …/grade` over `gradeSubmission`, returning the updated submission
- [x] Shared error shape; Zod boundary validation plus `validate*` functions returning `422` with field-level issues
- [x] Log authorization denials to the activity log from the route layer (the guards only throw today)
- [x] Apply the permission-matrix decision in `lib/server/permissions.ts` and document the final role matrix
- [x] Pagination, per-route integration tests (including `400`/`422` cases)
- **Done when:** every bullet in the PDF has a passing test (`test/brief.test.ts` walks them through the routes).

### Phase 4 — Depth

Scope was cut: the brief needs only the routes built in Phase 3, so the endpoints for academics, grading scales,
the missing view, grade history, activity, soft-delete and restore are deferred (see "Deferred from Phase 4" in
[future-ideas.md](future-ideas.md)). People, classes, assignments and scales get into the database through the seed
script and the test factories only. Decisions 1 to 5 below belong to the deferred endpoints and are not needed now.

**Decide before starting** (recommendation in italics):

1. What "new version" of a used grading scale does to things pointing at the old one: _classes and assignments keep
   the old scale unless moved explicitly; only the school default moves; old scales stay readable._
2. Re-adding a dropped student: _reactivate the existing seat and clear `dropped_at`, not a second row._
3. "Missing submission": _an active seat, a published and live assignment, and no live submission. Due dates are
   ignored while late work is undecided._
4. Gradebook shape: _students by assignments, each cell the grade label and points; no averages._
5. Restore rules: _administrator only, logged, and refused while the parent record is still deleted._
6. What reset clears: _every table through the owner connection, including auth, so sessions end._
7. Seed scope: _the seed script is the only way people get into a school, since there are no member endpoints; the
   Sandbox school is the one in sandbox-and-seed.md, with the default `America/New_York` time zone._
8. How the seed creates people: _through Better Auth's own sign-up, so passwords are hashed the way sign-in expects,
   with one shared dev password._
9. Running the seed on a database that already has data: _refuse and point at `pnpm db:reset`, rather than merging
   or duplicating._

- [x] Submit race protection + non-transactional race tests (`pnpm test:race`); allocate attempt numbers as the
      maximum over all rows including soft-deleted ones
- [x] Cross-tenant isolation test at the route level (`test/tenant-isolation.test.ts`; RLS is out of scope)
- [x] Remove the production-dead module code (deleted with its tests; the deferred endpoints would rebuild it)
- [x] Seed script and `pnpm db:seed` / `pnpm db:reset` (see sandbox-and-seed.md)
- [x] Sandbox reset endpoint (`POST /sandbox/api/reset`) and confirmed UI button

### Phase 5 — Docs

**Decide before starting** (recommendation in italics):

Decided (2026-10-04): no OpenAPI spec; accurate hand-built docs are enough for this project. The docs page is custom,
built from a small route registry (method, path, role, Zod schemas, error codes) with Zod's JSON Schema output for
field tables. One example definition per route generates the curl, Python and Node tabs, and a test runs each against
the seeded `sandbox` school. Background, authentication and a high-level codebase guide (key decisions, with links to
the code on GitHub) are Markdown rendered on the page.

- [x] Route registry and the docs page: background, authentication, routes (`/docs`)
- [x] Tabbed curl / Python / Node examples, tested against the sandbox school
- [x] Codebase guide: layout, key decisions, links to the code
- [x] Sandbox console reads routes from the registry instead of `catalog.ts`

### Phase 6 — Lightweight UI

**Decide before starting** (recommendation in italics):

1. UI authentication: _Bearer token kept in memory and `sessionStorage`, so the UI is a plain client of the public
   API._
2. Data fetching: _client components calling the REST API, so the request inspector shows real calls._
3. Screens in scope: _student (my submissions, submit), teacher (submissions overview, grade), administrator (grading
   scales)._
4. Monospace font: _the system monospace stack behind one CSS variable; no web font._

- [x] Dev-flavored monospace UI, `useOptimistic` + `startTransition`, via the REST API (all under `/sandbox`)
- [x] Persona sign-in, network log with copy-as-cURL, reset button with confirmation (sandbox-and-seed.md)
- [ ] Browser walk-through of every screen; component tests are not planned

### Phase 7 — Polish

Decided (2026-10-04) for the README: decision 2 became "local run plus a link to the live site" (the site is
https://homework-api-steel.vercel.app/; its sandbox is off). Decision 3 became system requirements, a local dev
server, a sample setup prompt for a coding agent, tests, and pointers to the code and plan. CI (decision 1) is
still open.

**Decide before starting** (recommendation in italics):

1. CI: _GitHub Actions with a Postgres service container running typecheck, lint, format check, tests and build._
2. Deployment: _none for the take-home; the README explains how to run it locally in two commands._ Answered above:
   local run plus the live link.
3. README scope: _what it is, run it, run the tests, the design decisions worth discussing, and what was deferred._
   Answered above.

- [x] README: setup, system requirements, how to run tests, the live URL
- [x] Docs site: move `lib/docs` into `app/docs/_lib`; shared site shell (header, theme, fonts) used by home, docs and
      sandbox; docs split into pages with a tree nav and per-endpoint reference pages; guides; sandbox and docs
      cross-links; homepage
- [ ] CI; final test-suite pass

## Future ideas

Deliberately deferred; none block the required API. Details, options and research live in
[future-ideas.md](future-ideas.md).

- Extra credit, late work, retention and purge, graded work with no upload,
  excused work, an Incomplete deadline, class averages and weighting, RLS, tamper-evident audit log, rate limits,
  optimistic concurrency on regrades, more Stripe-style API conventions.
