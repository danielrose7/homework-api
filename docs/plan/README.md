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

| Decision                                                                                                                       | Status  | Notes                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Next.js + Prisma + Postgres + Better Auth (self-hosted)                                                                        | Decided |                                                                                                                              |
| REST route handlers + OpenAPI generated from Zod, **no tRPC**                                                                  | Decided | tRPC can't be called cleanly from Python/curl. Standard verbs: GET / POST / PUT / PATCH / DELETE                             |
| Soft deletes (`deleted_at`/`deleted_by`/`deletion_reason`) with a separate, logged purge path                                  | Decided | FERPA-supportive; see data-model.md. Retention periods are district/state policy, not hard-coded                             |
| Stale-grade check uses `If-Match` ETag derived from `graded_at` (412/428), not `If-Unmodified-Since`                           | Decided | HTTP dates have 1s precision                                                                                                 |
| `class_enrollment` renamed `class_seat`                                                                                        | Decided |                                                                                                                              |
| `feedback` renamed `teacher_notes`                                                                                             | Decided | Matches the spec wording                                                                                                     |
| Timestamps (not revision numbers) for grade history + concurrency                                                              | Decided | `Timestamptz(3)` everywhere to avoid ms/µs mismatch                                                                          |
| `created_at`/`updated_at` both `@default(now())`; `updated_at` also `@updatedAt`; **no DB trigger**                            | Decided | DB default covers inserts; client sets updates. Raw SQL updates bypass `updated_at`, so we ban raw writes outside migrations |
| Append-only tables enforced by role grants + Prisma extension, **no DB trigger**                                               | Decided |                                                                                                                              |
| Grading scales are table-driven (`grading_scale` + `grading_scale_band`), with a school default and class/assignment overrides | Decided | Supports +/- letters and pass/fail                                                                                           |
| The graded result (band, label, group) is snapshotted on the submission and grade event; scales are immutable once used        | Decided | Reverses "letter never stored": editable scales would otherwise relabel past grades                                          |
| Sign-in is username + password (username plugin); email is required by Better Auth but contact-only                            | Decided | Usernames globally unique; `/sign-in/email` disabled                                                                         |
| Work in small reviewable commits (verb-first title + short narrative body)                                                     | Decided | See `AGENTS.md`                                                                                                              |
| Fully typed, `tsc --noEmit` as we go; boilerplate Prettier                                                                     | Decided |                                                                                                                              |
| RLS is **out of scope**; the schema is RLS-ready (`organization_id` almost everywhere, composite FKs)                          | Decided | Isolation is enforced in the service layer; see auth-and-tenancy.md appendix                                                 |
| UI is dev/API-flavored, monospace, demo-friendly, with a seed script and a reset button                                        | Decided | See demo-and-seed.md                                                                                                         |
| Fishery factories persist in `onCreate`; traits agreed together before writing                                                 | Decided | See testing.md                                                                                                               |
| Route tests build context through setup helpers                                                                                | Decided | See testing.md                                                                                                               |
| Demo seed data is separate from CI factories                                                                                   | Decided | Deterministic, readable names; see demo-and-seed.md                                                                          |

## Phases

Each phase ends with passing tests. Tick as we go.

### Phase 1 — Foundation

- [x] `git init`, `AGENTS.md`
- [x] pnpm, Next.js, strict TypeScript + `typecheck` script, Prettier
- [ ] shadcn init
- [ ] `docker-compose` Postgres; env handling
- [ ] Prisma setup; two connection strings (`DATABASE_URL` app role, migration URL owner)
- [ ] Better Auth: username+password (username plugin), organization plugin (custom roles), bearer plugin, UUIDv7 ids
- [ ] Shared timestamp conventions; schema guard test (every model has `createdAt` + `@updatedAt` unless allowlisted)
- [ ] `RequestContext` type and member/role guard helpers
- [ ] Vitest + rollback-per-test Prisma client
- [ ] Fishery factories (traits agreed with Daniel first; persistence in `onCreate`)
- [ ] Route-test setup helpers that build a context (school, users, tokens)
- **Done when:** a test signs up a user, creates an org, checks a role, and rolls back cleanly.

### Phase 2 — Data model and domain logic

- [ ] Full schema + migrations (see data-model.md), composite org FKs, `RESTRICT`
- [ ] DB roles + grants migration (`app_owner`, `app_user`, `app_readonly`)
- [ ] `submission_grade_event`, `activity_log`, `recordActivity`, append-only extension
- [ ] Soft-delete columns, Prisma read filter, partial unique indexes
- [ ] Grading scale + band tables, school default created on org creation, scale resolution
- [ ] Pure functions: points→grade band lookup, scale validation, term overlap, submission eligibility
- [ ] Service layer with org + role guards
- **Done when:** unit tests cover band boundaries across scale types, scoping, permissions.

### Phase 3 — Required API (the assignment)

- [ ] Student: submit; list own submissions (grade / assignment-name filters)
- [ ] Teacher: overview (assignment, date range, student-name filters); grade with points + `teacher_notes`
- [ ] Pagination, error shape, per-route integration tests
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

## Open questions

- Do students re-submit (`max_submissions` > 1) in the demo, or default to 1?
