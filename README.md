# Homework API

A multi-school REST API where students submit homework and teachers grade it. Take-home for Stride.

**Live: https://homework-api-steel.vercel.app/**

- [Docs](https://homework-api-steel.vercel.app/docs): background, authentication, every route with field tables,
  and curl / Python / Node examples that are run as tests.
- [Getting started](https://homework-api-steel.vercel.app/docs/getting-started): sign in and make your first calls.
- [Codebase guide](https://homework-api-steel.vercel.app/docs/architecture/overview): layout and the decisions
  worth discussing.

The sandbox (a console that sends real requests as seeded users, plus the "brief checks" that walk the
assignment's requirements) only runs when `SANDBOX_MODE=true`, so it is off on the live site. Run it locally.

## Stack

Next.js (App Router) and TypeScript, Postgres 17, Prisma, Better Auth, Zod, Vitest and Fishery, pnpm.

## System requirements

| Tool           | Version                                          | Why                                                        |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Node.js        | 22.12 or newer (developed on 24)                 | Prisma 7 and Vitest 5 set the floor                        |
| pnpm           | 11.25 (`corepack enable` picks it up)            | Pinned in `packageManager`; npm and yarn are not supported |
| Docker Compose | Docker Desktop or Engine with the compose plugin | Runs Postgres 17 on port **5433**                          |

Port 5433 (Postgres) and 3000 (the app) need to be free.

## Run it locally

```bash
git clone https://github.com/danielrose7/homework-api.git
cd homework-api
pnpm install
pnpm db:setup
pnpm dev
```

`pnpm db:setup` is the only setup command. It copies `.env.example` to `.env.local` if you have no env file, starts
Postgres, creates the database roles, applies the migrations, generates the Prisma client and, because
`SANDBOX_MODE=true` in the example env, seeds the **Sandbox** school. Re-running it is safe.

Then open http://localhost:3000:

- `/docs` for the docs
- `/sandbox/console` to call the API as a seeded user
- `/sandbox/checks` for the brief checks

Seeded users share the password `sandbox-dev`: `reyes` (administrator), `alvarez`, `chen` and `okafor`
(teachers), and students such as `maya`, `jon` and `priya`.

### Setting up with a coding agent

After `git clone` and `cd homework-api`, paste this into Claude Code or a similar agent:

```text
Read AGENTS.md and docs/plan/README.md, then set this project up locally: check that Node is 22.12 or newer,
pnpm is installed and Docker is running, then run `pnpm install` and `pnpm db:setup`. Start `pnpm dev`, confirm
http://localhost:3000/docs loads, and sign in through POST /api/auth/sign-in/username as `alvarez` with password
`sandbox-dev`. Report anything that failed and do not change any files.
```

### Database commands

| Command         | What it does                                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| `pnpm db:setup` | Start Postgres, apply roles and migrations, generate the client, seed if empty |
| `pnpm db:reset` | Truncate every table and re-seed (also the Reset button in the sandbox)        |
| `pnpm db:fresh` | Destroy the Docker volume, then `db:setup`; use after editing a migration      |
| `pnpm db:seed`  | Seed an empty database; refuses one that already has data                      |

## Run the tests

Docker must be running, since the tests use a real Postgres.

```bash
pnpm test        # unit and integration tests, then the race tests
pnpm test:race   # only the concurrency tests
pnpm test:watch  # watch mode
```

Integration tests run each case in a transaction that is rolled back, against a separate `homework_test` database
that Vitest creates. The race tests commit, so they use their own `homework_race` database. There is no CI
(GitHub Actions) for this project at this time, so run the checks by hand before committing:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

## Where to read next

- [Database schema](prisma/schema.prisma)
- [`modules/submissions`](modules/submissions): queries, mutations and serializers for submissions
- [Teacher overview route](app/api/v1/orgs/[org_slug]/submissions/route.ts) and
  [grade route](app/api/v1/orgs/[org_slug]/submissions/[submission_id]/grade/route.ts)
- [`docs/architecture.md`](docs/architecture.md): layout and dependency rules
- [`docs/plan/`](docs/plan/README.md): the plan, the decision log, and what was deferred
  ([future-ideas.md](docs/plan/future-ideas.md))
