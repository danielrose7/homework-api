# Testing

Integration tests against real Postgres are the backbone; unit tests cover pure logic; no e2e browser suite
(overkill for this scope).

## Layers

1. **Unit (pure):** points→grade band lookup (every boundary, exact decimals, extra credit, plus/minus and pass/fail scales, scale resolution order, scale validity rules, grading-mode payload validation), term overlap, submission eligibility, filter parsing.
2. **Service/integration (transaction-safe):** each test runs inside a transaction that is rolled back — a
   `jest-prisma`-style clone for Vitest (a Prisma client bound to an interactive transaction, injected into the
   code under test). Factories via **Fishery** (`user`, `organization`, `member`, `term`, `class`, `class_seat`,
   `assignment`, `submission`).
3. **Route-level:** call route handlers with real Bearer-authenticated requests inside the same rollback harness.
4. **Concurrency suite (non-transactional):** parallel requests need separate connections, which a single
   wrapping transaction cannot model. Runs against a separate database/schema, truncates between tests, kept
   small and clearly labelled.
5. **Guard tests:**
   - every Prisma model has `createdAt` + `@updatedAt` unless allowlisted (`activity_log`, `submission_grade_event`)
   - every tenant table has `organization_id`, composite FK to its parents
6. **Soft-delete tests:** default reads exclude deleted rows (including via relation includes); partial unique
   indexes allow re-creating a deleted natural key; DELETE requires a reason on education records; purge
   removes content but keeps the id-only `activity_log`.
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

## Route test helpers

Setup helpers build a ready-to-use context so a route test is a few lines:

- `createSchoolContext()` returns the school, administrator, teacher, students, a term, a class with seats and
  a published assignment.
- Each persona carries a signed-in Bearer token and a `request(as, method, path, body?)` helper that calls the
  route handler in-process with the right headers and returns status, headers and parsed JSON.
- Variants for common scenarios: `withGradedSubmission()`, `withTwoSchools()`, `withMissingWork()`.
- All run inside the rollback harness, so helpers never need cleanup.

## Harness notes

- Test client runs `SET LOCAL ROLE app_user` so grants (append-only tables) are exercised rather than bypassed
  by a superuser.
- Seed/reset scripts for local dev are separate from test data; see demo-and-seed.md.
- Race tests to write: N parallel submits with `max_submissions = 1` → exactly one success, rest `409`;
  idempotent retry returns the original; concurrent regrades → one `412`.

## Factory traits (proposal — to review together)

Not final. Mark up what to add, drop or rename.

| Factory                 | Traits                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`                  | `withPassword`, `unverified`                                                                                                                                     |
| `organization`          | `withDefaultTerm`                                                                                                                                                |
| `member`                | `administrator`, `teacher`, `student`                                                                                                                            |
| `academicYear` / `term` | `current`, `past`, `upcoming`, `overlapping` (for validation tests)                                                                                              |
| `class`                 | `withTeacher`, `withSeats(n)`, `inPastTerm`                                                                                                                      |
| `gradingScale`          | `standardAF` (default), `plusMinus`, `passFail`, `asDefault`, `used` (has a graded submission)                                                                   |
| `gradingScaleBand`      | `top`, `bottom` (min 0), `failing`                                                                                                                               |
| `classSeat`             | `active`, `dropped`                                                                                                                                              |
| `assignment`            | `pointsGraded`, `passFail` (band mode), `homework`, `exam`, `project`, `draft` (unpublished), `published`, `pastDue`, `singleAttempt`, `multiAttempt`, `deleted` |
| `submission`            | `ungraded`, `graded(points)`, `markedBand(label)`, `incomplete`, `late`, `regraded`, `deleted`                                                                   |
| `gradeEvent`            | `first`, `regrade` (requires reason)                                                                                                                             |
| `activityLog`           | `read`, `denied`, `system`                                                                                                                                       |

Open: should grade-band traits exist (`gradedA`…`gradedF`) or only `graded(points)` plus a table-driven boundary
test? Should `submission.graded()` also write a matching `gradeEvent` so history is never out of sync?
