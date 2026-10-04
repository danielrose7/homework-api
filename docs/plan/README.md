# Homework API — Plan

Take-home for Stride, a startup building a system of record for PT practices (assignment PDF:
`../../project_overview.pdf`). Spec says Python; the hiring
manager explicitly OK'd any language/framework. Suggested effort: 3–4 hours; we are going deeper on
purpose. Be ready to discuss, defend and extend every part.

This directory is the living plan. Update it as we go (tick boxes, add to the decision log).

| Doc                                                      | Contents                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| [data-model.md](data-model.md)                           | Tables, conventions (UUIDv7, timestamps, org scoping), grading rules |
| [auth-tenancy-rls.md](auth-tenancy-rls.md)               | Better Auth, roles, tenant context, DB roles, RLS prep               |
| [audit-and-grade-history.md](audit-and-grade-history.md) | HIPAA-style `activity_log`, grade events, regrade concurrency        |
| [testing.md](testing.md)                                 | Rollback-per-test, Fishery, guard tests, race tests                  |
| [api-and-docs.md](api-and-docs.md)                       | REST design, OpenAPI, tabbed examples, UI                            |

## Assignment requirements → where they land

- Students: submit homework; list own submissions; filter by grade (A–F, incomplete, ungraded) and assignment name.
- Teachers: overview of all submissions; filter by assignment name, date range (from–to), student name; grade a submission (A–F + comments).
- Homework object fields: assignment, student, submission date, grading date, final grade, **teacher notes** (`teacher_notes`).
- Unit tests for business logic. Documented endpoints. Code pushed to git ≥24h before review.

## Stack

Next.js (App Router) + TypeScript, Postgres, **Prisma**, **Better Auth** (self-hosted; organization + bearer

- API key plugins), shadcn/ui, Vitest + Fishery, pnpm (matches `../goji-health`).

## Decision log

| Decision                                                                                            | Status                               | Notes                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Next.js + Prisma + Postgres + Better Auth (self-hosted)                                             | Decided                              |                                                                                                                              |
| REST route handlers + OpenAPI generated from Zod, **no tRPC**                                       | **Proposed — awaiting confirmation** | tRPC can't be called cleanly from Python/curl, which the docs require                                                        |
| `class_enrollment` renamed `class_seat`                                                             | Decided                              |                                                                                                                              |
| `feedback` renamed `teacher_notes`                                                                  | Decided                              | Matches the spec wording                                                                                                     |
| Timestamps (not revision numbers) for grade history + concurrency                                   | Decided                              | `Timestamptz(3)` everywhere to avoid ms/µs mismatch                                                                          |
| `created_at`/`updated_at` both `@default(now())`; `updated_at` also `@updatedAt`; **no DB trigger** | Decided                              | DB default covers inserts; client sets updates. Raw SQL updates bypass `updated_at`, so we ban raw writes outside migrations |
| Append-only tables enforced by role grants + Prisma extension, **no DB trigger**                    | Decided                              |                                                                                                                              |
| Letter grade is computed, never stored                                                              | Decided                              |                                                                                                                              |
| Work in small reviewable commits (verb-first title + short narrative body)                          | Decided                              | See `AGENTS.md`                                                                                                              |
| Fully typed, `tsc --noEmit` as we go; boilerplate Prettier                                          | Decided                              |                                                                                                                              |
| RLS: prepare schema + roles + `withTenant` now; enable policies later                               | Decided                              | Enable for real in Phase 4–5 if Better Auth tables cooperate                                                                 |

## Phases

Each phase ends with passing tests. Tick as we go.

### Phase 1 — Foundation

- [x] `git init`, `AGENTS.md`
- [ ] pnpm, Next.js, strict TypeScript + `typecheck` script, Prettier, shadcn init
- [ ] `docker-compose` Postgres; env handling
- [ ] Prisma setup; two connection strings (`DATABASE_URL` app role, migration URL owner)
- [ ] Better Auth: email+password, organization plugin (custom roles), bearer plugin, UUIDv7 ids
- [ ] Shared timestamp conventions; schema guard test (every model has `createdAt` + `@updatedAt` unless allowlisted)
- [ ] `withTenant(ctx, fn)` helper (sets `app.*` settings per transaction)
- [ ] Vitest + rollback-per-test Prisma client + Fishery factories
- **Done when:** a test signs up a user, creates an org, checks a role, and rolls back cleanly.

### Phase 2 — Data model and domain logic

- [ ] Full schema + migrations (see data-model.md), composite org FKs, `RESTRICT`
- [ ] DB roles + grants migration (`app_owner`, `app_user`, `app_readonly`)
- [ ] `submission_grade_event`, `activity_log`, `recordActivity`, append-only extension
- [ ] Pure functions: points→letter, term overlap, submission eligibility
- [ ] Service layer with org + role guards
- **Done when:** unit tests cover letter-grade boundaries, scoping, permissions.

### Phase 3 — Required API (the assignment)

- [ ] Student: submit; list own submissions (grade / assignment-name filters)
- [ ] Teacher: overview (assignment, date range, student-name filters); grade with points + `teacher_notes`
- [ ] Pagination, error shape, per-route integration tests
- **Done when:** every bullet in the PDF has a passing test.

### Phase 4 — Depth

- [ ] Academic years, terms, classes, seats, assignments, gradebook
- [ ] "Missing submission" view
- [ ] Submit race protection + non-transactional race tests
- [ ] Regrade flow with timestamp `409`; history + activity endpoints
- [ ] Enable RLS policies + cross-tenant leak test (if feasible)
- [ ] Seed script

### Phase 5 — Docs

- [ ] OpenAPI spec generated from Zod, served at `/api/openapi.json`
- [ ] Docs page: background, authentication, routes
- [ ] Tabbed curl / Python / Node examples

### Phase 6 — Lightweight UI

- [ ] Student + teacher views (shadcn), `useOptimistic` + `startTransition`, via the REST API

### Phase 7 — Polish

- [ ] README: setup, design decisions, how to run tests
- [ ] CI; final test-suite pass

## Open questions

- Confirm REST + OpenAPI over tRPC.
- Username plugin on top of email login? (Spec says "username & password".)
- Do students re-submit (`max_submissions` > 1) in the demo, or default to 1?
