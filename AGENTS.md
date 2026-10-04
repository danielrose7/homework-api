# Agent guide

Take-home API for Stride (school homework submission + grading). The living plan is in `docs/plan/` — read
`docs/plan/README.md` first, tick checklist items and update the decision log as work lands.

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
- All DB access goes through `withTenant` once it exists; no raw-SQL writes in app code (`updated_at` is set by
  the Prisma client).
- Every domain table: UUIDv7 id, `organization_id`, `createdAt`/`updatedAt` (see `docs/plan/data-model.md`).
- Letter grades are computed from points, never stored.
- Audit/log rows are IDs only — never names, notes, or grade contents.
