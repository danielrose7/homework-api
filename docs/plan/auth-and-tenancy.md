# Auth and tenancy

Row-level security is **not** part of this build. The schema is designed to be RLS-ready so it can be added later
without reshaping tables; isolation today is enforced in the service layer and by composite foreign keys.

## Authentication (Better Auth, self-hosted)

- **Username + password** via the username plugin (`signIn.username`). Better Auth's core `user` table still
  requires an email, so email is stored as contact info only and `/sign-in/email` is disabled with
  `disabledPaths`. Usernames are normalized to lowercase and are **globally unique** (the `user` table is global,
  not per school). Seeded emails are placeholders like `alvarez@sandbox.test`.
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

## Request context

Each request resolves to a typed `RequestContext` (`organizationId`, `memberId`, `role`, `requestId`, actor type)
before any service runs. Services take the context as an explicit argument and scope every query by
`organizationId`; they never read it from ambient state. The same object feeds `recordActivity` (actor, org,
request id). API-key requests carry org + fixed role and no member.

## RLS-ready schema rules

These are what make a later RLS migration a policy-writing exercise rather than a redesign:

- `organization_id` NOT NULL on every domain table, including child, join and history tables, and indexed with
  `organization_id` as the leading column.
- Composite foreign keys `(organization_id, parent_id)` → parent `(organization_id, id)`, so a child can never
  point at another school's parent.
- School roles reference `member.id`, not `user.id`.
- No cross-tenant cascades (`ON DELETE RESTRICT`); soft deletes only through the API.
- Auth tables (`user`, `session`, `account`, `verification`) are global. They live in `public` for now; moving
  them to an `auth` schema is part of enabling RLS.
- Views, if any, are created `WITH (security_invoker = true)`.

## DB roles

Created by `db/init/01-roles.sql` for the local Docker database:

| Role           | Purpose                            | Privileges       |
| -------------- | ---------------------------------- | ---------------- |
| `app_owner`    | Owns objects; runs migrations only | DDL              |
| `app_user`     | Runtime role for the app           | DML only; no DDL |
| `app_readonly` | Reporting / ad hoc                 | `SELECT` only    |

- `app_user` gets `INSERT`/`SELECT` only on `activity_log` and `submission_grade_event` (append-only enforced by
  grants, plus a Prisma client extension that rejects `update`/`delete` on those models). No triggers.
- Two URLs: `DATABASE_URL` (`app_user`), `MIGRATION_DATABASE_URL` (`app_owner`) in `prisma.config.ts`.
- Prisma can't express roles or grants: hand-written SQL in migrations.
- The demo reset (see demo-and-seed.md) truncates tables, which `app_user` cannot do; it uses the owner connection.

## Appendix: enabling RLS later

Not scheduled. Sketch, so the schema choices above make sense:

- Set `app.organization_id`, `app.member_id`, `app.role` with `set_config(..., true)` inside an interactive
  transaction per request, and enable + force RLS with `organization_id = current_setting(...)` policies.
- Students: own submissions only. Teachers: submissions for classes they teach. Administrators: whole school.
- `organization`/`member` policies must not subquery `member` from its own policy (recursion).
