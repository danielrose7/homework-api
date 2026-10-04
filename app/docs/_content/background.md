Homework API is a small system of record for school homework: students hand work in and see how it was graded,
teachers see everything handed in and grade it. It was built as a take-home for Stride, and the whole surface is
a plain REST API with JSON bodies, so curl, Python and Node all talk to it the same way.

## What it does

- **Students** submit homework as text, files, or both; list their own submissions; filter them by grade (`A` to
  `F`, `incomplete`, `ungraded`) and by assignment name.
- **Teachers** get an overview of every submission in the classes they teach, filter it by assignment name, a
  date range and student name, and grade a submission with points or a band plus teacher notes.
- **Administrators** can do everything a teacher can, across the whole school.

A submission carries the assignment, the student, when it was submitted and graded, the final grade and the
teacher notes. Every regrade needs a reason, and the earlier grades are kept in a history (not yet readable over
the API).

## Schools and roles

Everything lives inside a school (an _organization_). A request names its school in the path, as
`/api/v1/orgs/{org_slug}/…`, and a person's role in that school decides what they may do. Roles are `student`,
`teacher` and `administrator`. A school's data is invisible from another school: asking for it is a `404`, the same
as asking for something that does not exist.

Grading scales are data, not code. A school has a default scale (the standard `A` to `F`), and a class or an
assignment can use another, such as plus/minus letters or pass/fail. The grade a submission earned is stored with it
when it is graded, so editing a scale later never relabels past work.

## The Sandbox school

The examples on this page run against a seeded school called **Sandbox** (slug `sandbox`). Every person in it signs
in with the password `sandbox-dev`.

| Role          | Usernames                                                     |
| ------------- | ------------------------------------------------------------- |
| Administrator | `reyes`                                                       |
| Teachers      | `alvarez` (Algebra I), `chen` (English 9), `okafor` (Biology) |
| Students      | `maya`, `jon`, `priya`, `theo`, `lena`, `omar`, `sam`, `noor` |

To run it yourself:

```sh
pnpm db:setup   # database, migrations and the Sandbox seed
pnpm dev        # http://localhost:3000
```

The [sandbox console](/sandbox/console) lets you sign in as any of them and try every route, and shows the
request it made so you can copy it as curl. It only exists while `SANDBOX_MODE=true`.
