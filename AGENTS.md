# Agent guide

Take-home API for Stride (school homework submission + grading). The living plan is in `docs/plan/` — read
`docs/plan/README.md` first, tick checklist items and update the decision log as work lands.

## Stack

Choices are settled (see the decision log in `docs/plan/README.md`); don't swap them without asking.

- Next.js App Router, TypeScript (strict), pnpm.
- Postgres 17 (docker-compose, port 5433) with **Prisma 7.10** and the `pg` driver adapter. Not Drizzle.
- **Better Auth**, self-hosted: email+password, organization, bearer and API key plugins.
- **Plain REST** route handlers under `/api/v1` using GET/POST/PUT/PATCH/DELETE. Not tRPC. Zod schemas are the
  source of truth for validation, types and the generated OpenAPI spec.
- shadcn/ui for the UI; `useOptimistic` + `startTransition` against the same REST API.
- Vitest + Fishery. Integration tests run in rolled-back transactions; concurrency tests are a separate,
  non-transactional suite.
- Prettier defaults for formatting.

## Code comments

Comments are sparse by design. Loud or redundant comments drift out of date, and later edits (human or LLM)
then trust the stale text over the code.

- Default to no comment. Good names and types carry the "what".
- Write a comment only for a non-obvious **why**: a hidden constraint, a workaround, a subtle invariant.
- Never narrate the code, restate a function name, or leave section banners, TODO essays or change-history notes.
- **Before finishing any change, re-read every comment in the files you touched** and delete or fix any that
  no longer match the code. When you change behavior, check the comments around it first.
- Do not rewrite or "improve" existing comments you were not asked to touch unless they are wrong.

## Types and checks

- TypeScript `strict`. No `any`, no unchecked casts, no `@ts-ignore` without an explanatory `@ts-expect-error`.
- Run `pnpm typecheck` (`tsc --noEmit`) after each meaningful batch of changes, plus `pnpm lint` and `pnpm test`.
  Do not commit with a failing check.
- Formatting is default Prettier (`pnpm format`). Don't hand-format.

## Git

- Small, reviewable commits; one logical change each. Stage specific files, not `git add -A`.
- Commit title: imperative and verb-first ("Add class_seat model"), under ~70 chars.
- Body: a brief narrative of what is included and why it was done this way, wrapped at ~72 columns.
- Keep docs in `docs/plan/` in the same commit as the change that affects them.

## Project rules

- pnpm only (no npm/yarn).
- Services take an explicit `RequestContext` and scope every query by `organizationId`. No RLS for now, but keep
  the schema RLS-ready. No raw-SQL writes in app code (`updated_at` is set by the Prisma client).
- Every domain table: UUIDv7 id, `organization_id`, `createdAt`/`updatedAt` (see `docs/plan/data-model.md`).
- The API never hard-deletes: `DELETE` is a soft delete (`deletedAt`/`deletedBy`/`deletionReason`).
- Letter grades are computed from points, never stored.
- Audit/log rows are IDs only — never names, notes, or grade contents.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
