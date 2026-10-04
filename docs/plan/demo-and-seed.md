# Demo, seed data and reset

The app should be usable, but its character is developer- and API-first and easy to demo: someone should be able
to clone it, run two commands, and click through a populated school while seeing the API calls underneath.

## Seed data (for people, not CI)

Separate from the test factories. CI data is random and disposable; seed data is **deterministic and readable**
so a demo script can say "sign in as Ms. Alvarez".

- `pnpm db:seed` loads a fixed starting point; `pnpm db:reset` truncates and re-seeds.
- One school named **Sandbox**, slug `sandbox`, with an academic year and two terms (one current). The seed script,
  the docs examples and the reset button all refer to it by that name. The slug is reserved so a real school
  can't take it.
- Administrator, 2–3 teachers, ~8 students with fixed names, emails and a shared dev password.
- Three grading scales: "Standard A–F" (school default), "Plus/minus" (one class override) and "Pass/Fail"
  (one assignment graded directly as Pass or Fail, with no points, inside a lettered class; plus one points-based
  assignment that passes at 60%).
- Usernames are short and memorable (`alvarez`, `chen`, `maya`) with one shared dev password.
- 3–4 classes across subjects, with seats, and a spread of assignments of every type.
- Submissions in every interesting state, deliberately: ungraded, graded A–F (one per letter), `incomplete`,
  never submitted (the "missing" view has something to show), a regraded submission with history, a
  soft-deleted assignment to demonstrate restore.
- Fixed UUIDv7s are not needed; the script prints a summary of ids and credentials at the end.
- Dates are relative to "now" so due dates and terms stay plausible whenever the DB is reset.
- The seed may reuse the Fishery factories for persistence, passing explicit attributes (names, scores). The
  data itself stays hand-authored.

## Reset

- **CLI:** `pnpm db:reset`.
- **Button:** a "Reset demo data" control in the UI that calls `POST /api/v1/dev/reset`.
- Truncates every table and re-runs the seed, including Better Auth tables, so any signed-in session is
  invalidated; the UI then drops back to the persona sign-in.
- The endpoint is **disabled unless `DEMO_MODE=true`** and always returns `404` otherwise, so it cannot exist in a
  real deployment by accident. It does not require a session, because the whole point is recovering from a broken
  state; the env flag is the guard.
- Uses the owner database connection (`app_user` cannot `TRUNCATE`).
- Logged as a `system` action in `activity_log` after the reset completes.

## UI character

- Monospace throughout, set through a single font token so a future switch to a proportional face is a one-line
  change (shadcn components are themed from CSS variables).
- Dense, table-first, little decoration; light and dark.
- **Persona switcher:** one-click sign-in as the seeded administrator, teachers and students (credentials shown
  on screen in demo mode).
- **Request inspector:** a collapsible panel showing the REST call each action makes (method, URL, status,
  JSON), plus a copy-as-curl button. The UI talks to the public API, so what you see is what a client would send.
- Links to the OpenAPI docs and the activity log from the nav.
- Optimistic updates (`useOptimistic` + `startTransition`) on submit and grade.

## Docs tie-in

The API docs' curl / Python / Node examples use the seeded school and users, so every example runs against a
freshly seeded database exactly as written.
