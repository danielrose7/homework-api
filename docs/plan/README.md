# Homework API — Plan

Take-home for Stride, a startup building a system of record for PT practices (assignment PDF:
`../../project_overview.pdf`). Spec says Python; the hiring
manager explicitly OK'd any language/framework. Suggested effort: 3–4 hours; we are going deeper on
purpose. Be ready to discuss, defend and extend every part.

This directory is the living plan. Update it as we go (tick boxes, add to the decision log).

| Doc                                                      | Contents                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| [data-model.md](data-model.md)                           | Tables, conventions (UUIDv7, timestamps, org scoping), grading rules  |
| [auth-and-tenancy.md](auth-and-tenancy.md)               | Better Auth, roles, request context, DB roles, RLS-ready schema rules |
| [demo-and-seed.md](demo-and-seed.md)                     | Seed data, reset button, dev-style UI                                 |
| [audit-and-grade-history.md](audit-and-grade-history.md) | HIPAA-style `activity_log`, grade events, regrade concurrency         |
| [demo-and-seed.md](demo-and-seed.md)                     | Seed data, reset button, dev-style UI                                 |
| [future-ideas.md](future-ideas.md)                       | Deferred features, options considered, and what is already prepared   |
| [testing.md](testing.md)                                 | Rollback-per-test, Fishery, guard tests, race tests                   |
| [api-and-docs.md](api-and-docs.md)                       | REST design, OpenAPI, tabbed examples, UI                             |

## Assignment requirements → where they land

- Students: submit homework; list own submissions; filter by grade (A–F, incomplete, ungraded) and assignment name.
- Teachers: overview of all submissions; filter by assignment name, date range (from–to), student name; grade a submission (A–F + comments).
- Homework object fields: assignment, student, submission date, grading date, final grade, **teacher notes** (`teacher_notes`).
- Unit tests for business logic. Documented endpoints. Code pushed to git ≥24h before review.

## Stack

Next.js (App Router) + TypeScript, Postgres, **Prisma**, **Better Auth** (self-hosted; organization, bearer and
API key plugins), shadcn/ui, Vitest + Fishery, pnpm (matches `../goji-health`).

## Decision log

| Decision                                                                                                                                  | Status       | Notes                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Next.js + Prisma + Postgres + Better Auth (self-hosted)                                                                                   | Decided      |                                                                                                                              |
| REST route handlers + OpenAPI generated from Zod, **no tRPC**                                                                             | Decided      | tRPC can't be called cleanly from Python/curl. Standard verbs: GET / POST / PUT / PATCH / DELETE                             |
| Soft deletes (`deleted_at`/`deleted_by`/`deletion_reason`); app and API code never hard-delete                                            | Decided      | Only dev tooling (seed, reset, test cleanup) hard-deletes, via the owner connection                                          |
| Retention is indefinite; no purge feature                                                                                                 | Decided      | FERPA-supportive; purge and retention windows are future decisions                                                           |
| "Incomplete" is a manual-only, neutral grade band (not a status, not null); `ungraded` = no band                                          | Decided      | Matches the brief's grade list; no `status` column                                                                           |
| Two-layer validation: Zod at the boundary, `validate*` functions for meaning; both return `422` with all field issues                     | Decided      | `409` is for state conflicts; see api-and-docs.md                                                                            |
| Extra credit is blocked; `assignment.score_cap_points` and `is_bonus` are reserved so it can be enabled without a migration               | Decided      | See future-ideas.md                                                                                                          |
| Submission files: `submission_attachment` modelled storage-agnostic; `multipart/form-data` into the database first; presigned R2/S3 later | **Proposed** | Confirm at the Phase 2/3 gate; see data-model.md                                                                             |
| Resubmission blocked by default (`max_submissions = 1`)                                                                                   | Decided      |                                                                                                                              |
| Cross-school requests return `404`; `403` only for in-school role failures                                                                | Decided      |                                                                                                                              |
| Late work is not enforced or flagged yet                                                                                                  | Decided      | Future decision: grading implications                                                                                        |
| Stale-grade check uses `If-Match` ETag derived from `graded_at` (412/428), not `If-Unmodified-Since`                                      | Decided      | HTTP dates have 1s precision                                                                                                 |
| `class_enrollment` renamed `class_seat`                                                                                                   | Decided      |                                                                                                                              |
| `feedback` renamed `teacher_notes`                                                                                                        | Decided      | Matches the spec wording                                                                                                     |
| Timestamps (not revision numbers) for grade history + concurrency                                                                         | Decided      | `Timestamptz(3)` everywhere to avoid ms/µs mismatch                                                                          |
| `created_at`/`updated_at` both `@default(now())`; `updated_at` also `@updatedAt`; **no DB trigger**                                       | Decided      | DB default covers inserts; client sets updates. Raw SQL updates bypass `updated_at`, so we ban raw writes outside migrations |
| Append-only tables enforced by role grants + Prisma extension, **no DB trigger**                                                          | Decided      |                                                                                                                              |
| Grading scales are table-driven (`grading_scale` + `grading_scale_band`), with a school default and class/assignment overrides            | Decided      | Supports +/- letters and pass/fail                                                                                           |
| Assignments have a `grading_mode`: `points` (scale lookup) or `band` (teacher picks Pass/Fail directly, no points)                        | Decided      | Pass/fail with no points needs nullable points and `max_points`; check constraints keep rows consistent                      |
| The graded result (band, label, group) is snapshotted on the submission and grade event; scales are immutable once used                   | Decided      | Reverses "letter never stored": editable scales would otherwise relabel past grades                                          |
| Sign-in is username + password (username plugin); email is required by Better Auth but contact-only                                       | Decided      | Usernames globally unique; `/sign-in/email` disabled                                                                         |
| Work in small reviewable commits (verb-first title + short narrative body)                                                                | Decided      | See `AGENTS.md`                                                                                                              |
| Fully typed, `tsc --noEmit` as we go; boilerplate Prettier                                                                                | Decided      |                                                                                                                              |
| RLS is **out of scope**; the schema is RLS-ready (`organization_id` almost everywhere, composite FKs)                                     | Decided      | Isolation is enforced in the service layer; see auth-and-tenancy.md appendix                                                 |
| The demo school is named "Sandbox" (slug `sandbox`), in the seed and in all docs examples                                                 | Decided      | Slug is reserved                                                                                                             |
| UI is dev/API-flavored, monospace, demo-friendly, with a seed script and a reset button                                                   | Decided      | See demo-and-seed.md                                                                                                         |
| Fishery factories persist in `onCreate`; traits agreed together before writing                                                            | Decided      | See testing.md                                                                                                               |
| Route tests build context through setup helpers                                                                                           | Decided      | See testing.md                                                                                                               |
| Demo seed data is separate from CI factories                                                                                              | Decided      | Deterministic, readable names; see demo-and-seed.md                                                                          |

## Deviations from the plan

Recorded as work lands; each is small but worth a look at the gate.

- Better Auth tables stay in the `public` schema. A separate `auth` schema needs Prisma multi-schema support and
  only mattered for RLS, which is out of scope.
- Better Auth tables keep `ON DELETE CASCADE` to their parents (they are Better Auth's own and the API never
  deletes users or schools). Our domain tables will use `RESTRICT`.
- Tests use a separate `homework_test` database created by Vitest global setup, and test files run serially.
- `package.json` sets `"type": "module"`.

## Phases

Each phase ends with passing tests. Tick as we go.

### Phase 1 — Foundation

- [x] `git init`, `AGENTS.md`
- [x] pnpm, Next.js, strict TypeScript + `typecheck` script, Prettier
- [x] shadcn init
- [x] `docker-compose` Postgres; env handling
- [x] Prisma setup; two connection strings (`DATABASE_URL` app role, migration URL owner)
- [x] Better Auth: username+password (username plugin), organization plugin (custom roles), bearer plugin, UUIDv7 ids
- [x] Shared timestamp conventions; schema guard test (every model has `createdAt` + `@updatedAt` unless allowlisted)
- [x] `RequestContext` type and member/role guard helpers
- [x] Vitest + rollback-per-test Prisma client
- [x] Fishery factories for user, organization, member (traits agreed first; persistence in `onCreate`); domain factories arrive with their tables in Phase 2
- [x] Baseline scenario helpers: `seedSchool()` returns signed-in personas (call it twice for an `other` school); later phases layer term, class and assignment on top
- **Done when:** a test signs up a user, creates an org, checks a role, and rolls back cleanly.

### Phase 2 — Data model and domain logic

- [ ] Full schema + migrations (see data-model.md), composite org FKs, `RESTRICT`
- [ ] DB roles + grants migration (`app_owner`, `app_user`, `app_readonly`)
- [ ] `submission_grade_event`, `activity_log`, `recordActivity`, append-only extension
- [ ] Soft-delete columns, Prisma read filter, partial unique indexes
- [ ] Grading scale + band tables, school default created on org creation, scale resolution
- [ ] `grading_mode` on assignments, nullable points, check constraints (hand-written SQL)
- [ ] Pure functions: points→grade band lookup, scale validation, term overlap, submission eligibility
- [ ] Service layer with org + role guards
- **Done when:** unit tests cover band boundaries across scale types, scoping, permissions.

### Phase 3 — Required API (the assignment)

- [ ] Student: submit; list own submissions (grade / assignment-name filters)
- [ ] Teacher: overview (assignment, date range, student-name filters); grade with points + `teacher_notes`
- [ ] Shared error shape; Zod boundary validation plus `validate*` functions returning `422` with field-level issues
- [ ] Pagination, per-route integration tests (including `400`/`422` cases)
- **Done when:** every bullet in the PDF has a passing test.

### Phase 4 — Depth

- [ ] Academic years, terms, classes, seats, assignments, gradebook
- [ ] Grading scale endpoints (create, new version, set default) and scale overrides
- [ ] "Missing submission" view
- [ ] Submit race protection + non-transactional race tests
- [ ] Regrade flow with ETag `412`/`428`; history + activity endpoints
- [ ] Cross-tenant isolation test at the service/route level (RLS is out of scope)
- [ ] Seed script and demo reset (see demo-and-seed.md)

### Phase 5 — Docs

- [ ] OpenAPI spec generated from Zod, served at `/api/openapi.json`
- [ ] Docs page: background, authentication, routes
- [ ] Tabbed curl / Python / Node examples

### Phase 6 — Lightweight UI

- [ ] Dev-flavored monospace UI (shadcn), `useOptimistic` + `startTransition`, via the REST API
- [ ] Persona sign-in, API request viewer, reset button (demo-and-seed.md)

### Phase 7 — Polish

- [ ] README: setup, design decisions, how to run tests
- [ ] CI; final test-suite pass

## Future ideas

Deliberately deferred; none block the required API. Details, options and research live in
[future-ideas.md](future-ideas.md).

- Extra credit (columns reserved, feature blocked), late work, retention and purge, graded work with no upload,
  excused work, an Incomplete deadline, class averages and weighting, RLS, tamper-evident audit log.
