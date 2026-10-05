Three calls take a piece of homework from a student's hand to a teacher's grade. Every request below is a real one
that runs against the seeded [Sandbox school](/docs/sandbox-school).

## Run it

Using the live site, skip this and open the [sandbox console](/sandbox/console). To run it yourself, follow
[Run it locally in the README](https://github.com/danielrose7/homework-api#run-it-locally). In short:

```sh
pnpm db:setup   # database, migrations and the Sandbox seed
pnpm dev        # http://localhost:3000
```

Then set the variables the examples read. [Running the examples](/docs/run-the-examples) lists them all.

```sh
export HOST=http://localhost:3000
```

## 1. Sign in

Sign in with a username and password. The reply carries a bearer token; keep it in `TOKEN`.

```example
sign_in | Sign in
```

## 2. Submit homework

Maya hands in her answer to an assignment. Her `TOKEN` and the `ASSIGNMENT_ID` come from the previous steps.

```example
submit | Submit text
```

## 3. Grade it

Sign in as a teacher the same way, then grade the submission with points.

```example
grade | Grade with points
```

The reply is the submission again, now with a `grade`. Ask for it as the student to see what they see:

```example
get | Read one of my submissions
```

## Where next

- [Submit homework](/docs/guides/submit-homework) covers files, limits and the errors you can hit.
- [Grade submissions](/docs/guides/grade-submissions) covers filtering what is waiting and regrading.
- Prefer clicking to typing? Open the [sandbox console](/sandbox/console); every call above is there.
