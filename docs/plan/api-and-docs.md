# API design, OpenAPI docs, UI

## API (REST — pending confirmation, see README decision log)

- Route Handlers under `/api/v1/orgs/{orgSlug}/…`. Zod schemas are the single source of truth for validation,
  types and OpenAPI (`zod-to-openapi` or similar). Handlers are thin; logic lives in a service layer that the UI
  also calls.
- Auth: `Authorization: Bearer <token>` (or `x-api-key`). Org from the path; membership + role checked per request.
- Consistent error shape: `{ error: { code, message, details? } }`; `409` for conflicts, `412`/`428` for failed/missing preconditions, `403` vs `404` policy
  decided deliberately (don't leak cross-tenant existence).
- Pagination: cursor-based on `(created_at, id)`; filters as query params.

### Verb conventions

- `GET` safe and cacheable; `POST` creates (returns `201` + `Location`); `PUT` replaces a resource or sets a
  singleton sub-resource idempotently; `PATCH` partial update (JSON merge-patch semantics); `DELETE` soft-deletes
  (`204`), requires a `reason` where the resource is an education record.
- Soft-deleted resources return `404` to normal callers; an admin-only `?include_deleted=true` exists for
  review.

### Routes (draft)

| Method + path                                     | Who           | Purpose                                                                                     |
| ------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| `POST /assignments/{id}/submissions`              | student       | Submit (idempotent via `Idempotency-Key`; `409` over limit)                                 |
| `GET /submissions/me?grade=&assignment=`          | student       | Own submissions; grade ∈ `A–F`, `incomplete`, `ungraded`                                    |
| `GET /submissions?assignment=&from=&to=&student=` | teacher/admin | Overview                                                                                    |
| `PUT /submissions/{id}/grade`                     | teacher       | Set current grade (points + `teacher_notes`); `If-Match` → `412` if stale, `428` if missing |
| `GET /submissions/{id}/history`                   | teacher/admin | Grade events                                                                                |
| `GET /assignments/{id}/missing`                   | teacher/admin | Enrolled students with no submission                                                        |
| `GET /activity`                                   | admin         | Audit log                                                                                   |
| Terms / classes / seats / assignments CRUD        | admin/teacher | Phase 4: `POST` create, `GET` read, `PUT` replace, `PATCH` partial, `DELETE` soft-delete    |

Submission response includes: assignment, student, `submitted_at`, `graded_at`, `letter_grade` (computed),
`points_awarded`, `teacher_notes`.

## Docs (Phase 5)

- OpenAPI served at `/api/openapi.json`; docs page in-app.
- Sections: **project background**, **authentication** (Bearer flow, API keys), **routes** (generated).
- Examples for every key route in **tabbed curl / Python (`requests`) / Node (`fetch`)**: sign in → token →
  submit → grade.

## UI (Phase 6)

- Lightweight, shadcn/ui; student and teacher views loosely modeled on `../goji-health`.
- `useOptimistic` + `startTransition` for submit/grade, but the UI talks to the same REST API (not server-only
  actions) so the API stays the real product surface.
