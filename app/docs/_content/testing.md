Integration tests run each case in a rolled-back transaction against real Postgres, with Fishery factories and
scenario helpers such as
[`seedSchool`](https://github.com/danielrose7/homework-api/blob/main/test/scenarios/school.ts). The examples on this
page are tests too:
[`test/docs-examples.test.ts`](https://github.com/danielrose7/homework-api/blob/main/test/docs-examples.test.ts)
runs each against the seeded Sandbox school, and
[`app/docs/_lib/__tests__/snippets.test.ts`](https://github.com/danielrose7/homework-api/blob/main/app/docs/_lib/__tests__/snippets.test.ts)
runs the curl, Python and Node versions and checks what each sends.
