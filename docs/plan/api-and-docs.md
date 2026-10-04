# API design, OpenAPI docs, UI

## API (REST — pending confirmation, see README decision log)

- Route Handlers under `/api/v1/orgs/{orgSlug}/…`. Zod schemas are the single source of truth for validation,
  types and OpenAPI (`zod-to-openapi` or similar). Handlers are thin; logic lives in a service layer that the UI
  also calls.
- Handlers are wrapped in `serve(...)` (`lib/server/serve.ts`), which resolves the `RequestContext` from the bearer
  token and the `orgSlug` path segment, gives the handler `input.params/query/body(zodSchema)` parsers, and maps
  `ApiError`, Zod failures (`422`), unparseable JSON (`400`) and anything unexpected (generic `500`, logged with the
  request id) to the error shape below. Every response carries `x-request-id`. `createServe(deps)` takes the auth and
  database explicitly so route tests can pass the rolled-back client.
- Auth: `Authorization: Bearer <token>` (or `x-api-key`). Org from the path; membership + role checked per request.
- Consistent error shape: `{ error: { code, message, details? } }`; `409` for conflicts, `412`/`428` for failed/missing preconditions, a resource in another school returns `404`
  (existence isn't leaked); `403` only when the caller is a member of the school but lacks the role.
- Pagination: cursor-based on `(submitted_at, id)`, newest first. Lists answer `{ data: [...], next_cursor }`; send
  `cursor` and `page_size` (default 25, maximum 100). Filters are query params, and unknown ones are rejected.
- JSON field names are `snake_case`. Validation error `field`s use the same names (`teacher_notes`, `files.1.content_type`), however the service named them. Timestamps in responses are ISO 8601 with an offset.
- Dates and times are the school's, not UTC: `from`/`to` are calendar dates, both inclusive, read in the time zone
  stored in `organization_preferences` (IANA name). `from` starts at 00:00 and `to` ends at 24:00 in that zone, so
  a day with a daylight-saving change is still one whole day.

### Verb conventions

- `GET` safe and cacheable; `POST` creates (returns `201` + `Location`); `PUT` replaces a resource or sets a
  singleton sub-resource idempotently; `PATCH` partial update (JSON merge-patch semantics); `DELETE` soft-deletes
  (`204`), requires a `reason` where the resource is an education record.
- Soft-deleted resources return `404` to normal callers; an admin-only `?include_deleted=true` exists for
  review.

### Routes (draft)

| Method + path                                                                                                                        | Who                                         | Purpose                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /submissions/{id}/attachments`                                                                                                  | student (own), teacher/admin                | List attachment metadata                                                                                    |
| `GET /submissions/{id}/attachments/{attachmentId}`                                                                                   | student (own), teacher/admin                | Download an attachment (streamed, logged)                                                                   |
| `POST /assignments/{id}/submissions`                                                                                                 | student                                     | Submit as JSON `{ text }` or multipart (`text`, repeated `files`); `409` over the limit                     |
| `GET /submissions/me?grade=&assignment=`                                                                                             | student                                     | Own submissions; grade ∈ `A–F`, `incomplete`, `ungraded`                                                    |
| `GET /submissions?assignment=&from=&to=&student=&grade=`                                                                             | teacher (own classes), admin                | Overview; `student` is at least 2 characters; `from`/`to` are school-time days                              |
| `GET /submissions/{id}`                                                                                                              | student (own), teacher (own classes), admin | One submission; sends the grade version as an `ETag` once graded                                            |
| `PUT /submissions/{id}/grade`                                                                                                        | teacher (own classes), admin                | Set current grade (`points` or `band`, plus `teacher_notes`); `If-Match` → `412` if stale, `428` if missing |
| `GET /submissions/{id}/history`                                                                                                      | teacher/admin                               | Grade events                                                                                                |
| `GET /assignments/{id}/missing`                                                                                                      | teacher/admin                               | Enrolled students with no submission                                                                        |
| `GET /activity`                                                                                                                      | admin                                       | Audit log                                                                                                   |
| `GET/POST /grading-scales`, `GET/PATCH/DELETE /grading-scales/{id}`, `PUT /grading-scales/{id}/bands`, `PUT /grading-scales/default` | admin                                       | Scales and bands; edits to a used scale create a new version                                                |
| Terms / classes / seats / assignments CRUD                                                                                           | admin/teacher                               | Phase 4: `POST` create, `GET` read, `PUT` replace, `PATCH` partial, `DELETE` soft-delete                    |

Submission response includes: assignment, student, `submitted_at`, `graded_at`, a `grade` object (`label`, `group`, `points_awarded`,
`max_points`, `percent`, `scale_id`; points fields are `null` for pass/fail-by-band work) that is `null` until graded, plus `teacher_notes`.

## Validation and errors

Every write and every filtered read is validated in two layers. Both produce the same error shape.

1. **Shape (Zod):** types, required fields, formats, lengths, enums, UUIDs, ISO dates, number precision. Runs at
   the route boundary, including query strings and path params.
2. **Meaning (`validate*` functions):** rules Zod can't express because they depend on other fields or on data.
   These are plain functions in the service layer, `validateX(input, context) => ValidationIssue[]`, so they are
   unit-testable without HTTP. Services run them before writing and re-check anything race-sensitive inside the
   transaction.

Database constraints (unique keys, check constraints, composite foreign keys) remain the final backstop. A
violation that slips through is translated to `409` or `422`, never a raw `500`.

### Status codes

| Code          | Meaning                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `400`         | Request can't be parsed (malformed JSON, wrong content type)                                          |
| `401`         | No or invalid credentials                                                                             |
| `403`         | Authenticated member of the school, but the role can't do this                                        |
| `404`         | Resource missing, deleted, or in another school                                                       |
| `409`         | Valid request that conflicts with current state (over-submission limit, duplicate seat, frozen scale) |
| `412` / `428` | Stale or missing `If-Match` on a regrade                                                              |
| `422`         | Parsed fine but the values are invalid: any Zod failure or `validate*` issue                          |

Rule of thumb: if changing the input could make it succeed, it's `422`; if the input is fine but the world is in
the way, it's `409`.

### Error shape

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed",
    "details": [
      {
        "field": "points",
        "code": "exceeds_max_points",
        "message": "Points cannot exceed 50"
      },
      {
        "field": "band",
        "code": "unknown_band",
        "message": "No band named \"Pass\" on this scale"
      }
    ]
  }
}
```

- All issues are returned at once, not just the first.
- `field` is a path into the body, query or params (`bands[2].label`, `query.from`). `code` is a stable,
  documented machine value; `message` is for humans.
- Zod issues are mapped into this shape so clients see one format.
- An id in a body that belongs to another school is reported exactly like one that doesn't exist
  (`code: "not_found"` on that field), so existence isn't leaked.

### Semantic rules by area (starting list)

| Area          | Rules enforced beyond Zod                                                                                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grade (`PUT`) | Payload matches the assignment's `grading_mode`; `points` is 0 to `max_points` with at most two decimals; `band` names a band on the resolved scale and only a manual-only band in `points` mode; `reason` required on a regrade (optional when replacing an Incomplete); `teacher_notes` length cap |
| Submission    | Content non-empty and within the size cap; assignment is published and not deleted; student has an active seat in that class                                                                                                                                                                         |
| Assignment    | `max_points` > 0 in `points` mode and absent in `band` mode; `max_submissions` ≥ 1; referenced scale exists in the same school; mode, `max_points` and scale unchanged once graded (`409`)                                                                                                           |
| Grading scale | At least one band; a computed band at `min_percent` 0; no duplicate thresholds or labels; labels non-empty and not `ungraded`; `min_percent` ≥ 0; GPA values in range; at most one default                                                                                                           |
| Term / year   | End after start; terms inside the academic year; no overlap between terms of one year                                                                                                                                                                                                                |
| Class / seat  | Teacher id is a member with the teacher role; student id is a member with the student role; class belongs to a non-deleted term; duplicate seat is `409`                                                                                                                                             |
| List filters  | `from` ≤ `to`; ISO dates; `grade` is a known label, group or `ungraded`; page size within bounds; cursor decodes; unknown query params rejected                                                                                                                                                      |

Each rule gets a stable `code`, a unit test on the validator, and a route test asserting the `422` body. The
OpenAPI spec documents the codes per endpoint.

## Docs (Phase 5)

- OpenAPI served at `/api/openapi.json`; docs page in-app.
- Sections: **project background**, **authentication** (Bearer flow, API keys), **routes** (generated).
- Examples for every key route in **tabbed curl / Python (`requests`) / Node (`fetch`)**: sign in → token →
  submit → grade.

## UI (Phase 6)

Dev-flavored, monospace, demo-friendly; details in [demo-and-seed.md](demo-and-seed.md). shadcn/ui, with
`useOptimistic` + `startTransition` for submit/grade. The UI calls the same REST API (not server-only actions)
so the API stays the real product surface, and a request inspector shows each call.
