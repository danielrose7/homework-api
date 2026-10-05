Integration tests run each case in a rolled-back transaction against real Postgres, with Fishery factories and
scenario helpers such as
[`seedSchool`](https://github.com/danielrose7/homework-api/blob/main/test/scenarios/school.ts). The examples on this
page are tests too:
[`test/docs-examples.test.ts`](https://github.com/danielrose7/homework-api/blob/main/test/docs-examples.test.ts)
runs each against the seeded Sandbox school, and
[`app/docs/_lib/__tests__/snippets.test.ts`](https://github.com/danielrose7/homework-api/blob/main/app/docs/_lib/__tests__/snippets.test.ts)
runs the curl, Python and Node versions and checks what each sends.

## Run the tests

Docker must be running, since the tests use a real Postgres. After [setting the project up](https://github.com/danielrose7/homework-api#run-it-locally):

```sh
pnpm test        # unit and integration tests, then the race tests
pnpm test:race   # only the concurrency tests
pnpm test:watch  # watch mode
```

Integration tests run in a separate `homework_test` database that Vitest creates. The race tests commit, so they use
their own `homework_race` database. Before committing, run all the checks:

```sh
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

## No CI yet

There is no continuous integration (no GitHub Actions workflow) for this project at this time. The checks above are
run by hand before each commit.
