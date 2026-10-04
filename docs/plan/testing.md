# Testing

Integration tests against real Postgres are the backbone; unit tests cover pure logic; no e2e browser suite
(overkill for this scope).

## Layers

1. **Unit (pure):** points→grade band lookup (every boundary, exact decimals, plus/minus and pass/fail scales, scale resolution order, scale validity rules, grading-mode payload validation), term overlap, submission eligibility, filter parsing, and every `validate*` function (one case per rule code, plus several simultaneous issues).
2. **Service/integration (transaction-safe):** each test runs inside a transaction that is rolled back — a
   `jest-prisma`-style clone for Vitest (a Prisma client bound to an interactive transaction, injected into the
   code under test). Factories via **Fishery** (`user`, `organization`, `member`, `term`, `class`, `class_seat`,
   `assignment`, `submission`).
3. **Route-level:** every write route has a `422` test asserting the full error body, and a `400` test for
   malformed JSON.
   call route handlers with real Bearer-authenticated requests inside the same rollback harness.
4. **Concurrency suite (non-transactional):** parallel requests need separate connections, which a single
   wrapping transaction cannot model. Runs against a separate database/schema, truncates between tests, kept
   small and clearly labelled.
5. **Guard tests:**
   - every domain Prisma model has `created_at` + `@updatedAt` unless allowlisted (`activity_log`, `submission_grade_event`)
   - every tenant table has `organization_id`, composite FK to its parents
   - dynamic API route segments and route-owned Zod object fields use `snake_case`
6. **Soft-delete tests:** default reads exclude deleted rows (including via relation includes); partial unique
   indexes allow re-creating a deleted natural key; DELETE requires a reason on education records; no code path
   outside dev tooling hard-deletes.
7. **Cross-tenant isolation test:** two schools; as a member of school A, every route and service returns
   nothing from school B and cross-school writes fail. Enforced in the service layer (no RLS).

## Factories (Fishery)

- Persistence happens in Fishery's `onCreate` hook: `build()` returns plain objects, `create()` inserts through
  the Prisma client. Factories receive the client through a transient param so the same factory works with the
  rollback client in tests and the real client in the seed script.
- Traits are agreed with Daniel before the factories are written. Proposed starting set is in the "Factory
  traits" section of this doc; edit it there.
- Associations are created lazily in `onCreate` (a `submission` creates its `assignment`, `class_seat`, etc. if
  none are passed), so `submissionFactory.create()` alone yields a valid row.
- Sequences for emails and names; no real faker data in assertions.

## Baseline scenarios

Tests don't rebuild a school by hand. `test/scenarios/` holds layered helpers, each building on the one below, so a
test starts from the layer it needs:

1. `seedSchool()`: a school, an administrator, one teacher and one student by default (`{ teachers, students }` change the counts,
   zero is allowed), each a real Better Auth user
   who has signed in (Bearer headers plus a `context()` that resolves a `RequestContext`).
2. For isolation tests, call `seedSchool()` twice and treat the second as `other`.
3. `seedClass()`: adds a current term, a class every seeded teacher teaches and every seeded student attends.
4. `seedAssignment()`: adds a published points-graded homework (override with `{ assignment: {...} }`).
5. `seedSubmission()`: adds the first student's submission, optionally graded: `{ grade: { points: "92" } }` or
   `{ grade: { band: "Incomplete" } }`.

Factories never share state between tests (everything rolls back) and run queries one at a time, because
concurrent queries on a single transaction connection are deprecated in `pg`. Factory users are created through
Better Auth sign-up, so every one has a real password hash and can sign in with its username.

## Route test helpers

Route handlers are `defineRoute` definitions, so a test runs one through the real wrapper without a server:

- `callRoute(route, params, { method, headers, query, json, raw, form })` in `test/http.ts` builds a real `Request`,
  runs it through `createServe` with the rolled-back client, and returns the `Response`. Path parameters are passed
  in `params` (`org_slug` plus any ids).
- Personas from `seedSchool`, `seedClass`, `seedAssignment` and `seedSubmission` already carry a signed-in Bearer
  `headers`, so a route test is a few lines.
- `test/brief.test.ts` follows the assignment brief through the routes only: students submit and filter, teachers
  see the overview, filter and grade.
- All run inside the rollback harness, so nothing needs cleanup.

## Harness notes

- Tests must not import the app-wide `auth` or `prisma` singletons; they commit outside the test transaction. An
  ESLint `no-restricted-imports` rule enforces this for test files, and the singletons carry a JSDoc saying why.
- Test client runs `SET LOCAL ROLE app_user` so grants (append-only tables) are exercised rather than bypassed
  by a superuser.
- Seed/reset scripts for local dev are separate from test data; see demo-and-seed.md.
- Race tests to write: N parallel submits with `max_submissions = 1` → exactly one success, rest `409`;
  idempotent retry returns the original; concurrent regrades → both applied in order, two history rows.

## Factory traits

Built (see `test/factories/`):

| Factory                     | Traits                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`                      | none; always a real Better Auth sign-up                                                                                                                                    |
| `organization`              | `sandbox()`; creates the default grading scale                                                                                                                             |
| `member`                    | `administrator()`, `teacher()`, `student()`                                                                                                                                |
| `academicYear`              | none                                                                                                                                                                       |
| `term`                      | `current()`, `past()`, `upcoming()`                                                                                                                                        |
| `gradingScale`              | `standardAF()`, `plusMinus()`, `passFail()`, `asDefault()`                                                                                                                 |
| `class`                     | `withTeachers(n)`, `withStudents(n)` (transient counts)                                                                                                                    |
| `classTeacher`, `classSeat` | `classSeat`: `active()`, `dropped()`                                                                                                                                       |
| `assignment`                | `homework()`, `exam()`, `quiz()`, `project()`, `pointsGraded(max)`, `passFail()`, `draft()`, `published()`, `pastDue()`, `singleAttempt()`, `multiAttempt(n)`, `deleted()` |
| `submission`                | `ungraded()`, `graded(points, notes?)`, `markedBand(label, notes?)`, `incomplete(notes?)`, `deleted()`                                                                     |

A graded submission goes through the same write path as `gradeSubmission`, so its grade-history row always exists.

Not built yet, add when a test needs them: a `regraded` submission trait, `gradingScale.used`, `term.overlapping`,
a `gradeEvent` factory and an `activityLog` factory.
