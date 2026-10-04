# Testing

Integration tests against real Postgres are the backbone; unit tests cover pure logic; no e2e browser suite
(overkill for this scope).

## Layers

1. **Unit (pure):** points→letter (every boundary), term overlap, submission eligibility, filter parsing.
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
   - (when RLS is on) every tenant table has RLS enabled + forced and ≥1 policy
6. **Soft-delete tests:** default reads exclude deleted rows (including via relation includes); partial unique
   indexes allow re-creating a deleted natural key; DELETE requires a reason on education records; purge
   removes content but keeps the id-only `activity_log`.
7. **Cross-tenant leak test:** two orgs; as `app_user` with org A's context, every table returns zero org B rows
   and cross-org writes fail.

## Harness notes

- Test client runs `SET LOCAL ROLE app_user` plus the `app.*` settings so policies/grants are exercised rather
  than bypassed by a superuser.
- Seed/reset scripts for local dev are separate from test factories.
- Race tests to write: N parallel submits with `max_submissions = 1` → exactly one success, rest `409`;
  idempotent retry returns the original; concurrent regrades → one `412`.
