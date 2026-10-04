# Auth, tenancy, DB roles, RLS prep

## Authentication (Better Auth, self-hosted)

- Email + password. Username plugin: open question.
- **Bearer plugin** (primary for API docs): sign in → token in the `set-auth-token` response header → send
  `Authorization: Bearer <token>`. Server: `auth.api.getSession({ headers })`.
- **API key plugin** (integrations): header `x-api-key` by default, configurable via `apiKeyHeaders`.
  Org-owned keys cannot impersonate a user session (`enableSessionForAPIKeys` only works for user-owned keys and
  is discouraged). Keys are not required for the assignment.
- **Organization plugin:** school = organization (unique slug). Custom roles via `createAccessControl`:
  `administrator`, `teacher`, `student`. Server checks via `auth.api.hasPermission()`.
- **Org comes from the URL** (`/api/v1/orgs/{slug}/…`), not the session's "active organization" — stateless
  requests, self-contained curl examples. Resolve slug → org → verify membership on every request.
- Better Auth ids generated as UUIDv7 via `advanced.database.generateId`.

Sources: better-auth.com/docs/plugins/{bearer,api-key,organization}.

## Tenant context: `withTenant`

All DB access goes through `withTenant(ctx, async (tx) => …)`, an interactive transaction that first runs
```sql
SELECT set_config('app.organization_id', $1, true),
       set_config('app.member_id',       $2, true),
       set_config('app.role',            $3, true);
```
(`true` = transaction-local; safe under transaction-mode pooling.) Built in Phase 1, before RLS exists, so
enabling RLS later changes no application code. The same context object feeds `recordActivity` (actor, org,
request id). API-key requests set org + fixed role, no member.

## DB roles

| Role | Purpose | Privileges |
|---|---|---|
| `app_owner` | Owns objects; runs migrations only | DDL |
| `app_user` | Runtime role for the app | `NOBYPASSRLS`; DML only; no DDL/`TRUNCATE` |
| `app_readonly` | Reporting / ad hoc | `SELECT` only, subject to RLS |

- `FORCE ROW LEVEL SECURITY` on tenant tables so an owner connection can't leak.
- `app_user` gets `INSERT`/`SELECT` only on `activity_log` and `submission_grade_event` (append-only enforced by
  grants, plus a Prisma client extension that rejects `update`/`delete` on those models). No triggers.
- Two URLs: `DATABASE_URL` (`app_user`), migration URL (`app_owner`) in `prisma.config.ts`.
- Prisma can't express roles/policies/grants: hand-written SQL in migrations.

## Policies (to write in Phase 4–5)

- **All tenant tables:** `organization_id = current_setting('app.organization_id')::uuid`.
- **Students:** own submissions only (`student member = app.member_id`); no `SELECT` on
  `submission_grade_event` or `activity_log`.
- **Teachers:** submissions only for classes they teach (`EXISTS` on `class_teacher`) — most expensive policy;
  index and benchmark.
- **Administrators:** whole org; may read `activity_log`.
- Views must be `WITH (security_invoker = true)`. Avoid `SECURITY DEFINER`; pin `search_path` if unavoidable.
- `organization`/`member` policies must not subquery `member` from `member`'s own policy (recursion) — key off
  the `app.*` settings.
- Auth tables in schema `auth`; app role gets only what Better Auth needs.

## Risks

Better Auth tables are the awkward part for RLS. Fallback: RLS on domain tables only, documented in the README.
Interactive transactions per request cost a connection hold; acceptable at this scale.
