Every route follows the same conventions, so they are described once here.

## Shape of the data

- JSON bodies and responses use `snake_case` field names.
- Every resource has an `object` field naming its type, such as `"submission"`, and an `id`.
- Timestamps are ISO 8601 with an offset, such as `2026-10-02T14:03:11.482Z`.
- Dates in filters (`from`, `to`) are calendar days read in the **school's time zone**, not UTC, and both ends are
  inclusive.
- Every response has an `x-request-id` header; quote it when reporting a problem.

## Lists

A list answers a list object, newest first:

```json
{
  "object": "list",
  "url": "/api/v1/orgs/sandbox/submissions",
  "has_more": true,
  "data": []
}
```

Page with `limit` (default 25, at most 100) and `starting_after=<id of the last item you have>`. There is no total
count. A `starting_after` that is not in the list, or a filter or parameter the route does not know, is a `422`.

## Errors

Failures use one shape, and a `422` lists every problem at once:

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "validation_failed",
    "message": "Request validation failed",
    "param": "points",
    "details": [
      {
        "field": "points",
        "code": "exceeds_max_points",
        "message": "Points cannot exceed 50"
      }
    ]
  }
}
```

`type` is `invalid_request_error`, `authentication_error` (401), `permission_error` (403) or `api_error` (500).
`code` is a stable machine value. `param` is the first problem's `field`, and `details` has them all, with `field`
as a path into the body or query (`files.1.file`, `query.from`).

| Status | Meaning                                                                                      |
| ------ | -------------------------------------------------------------------------------------------- |
| `400`  | The request could not be read, such as malformed JSON.                                       |
| `401`  | No token, or an invalid one.                                                                 |
| `403`  | A member of the school, but the role cannot do this.                                         |
| `404`  | Missing, not yours to see, or in another school.                                             |
| `409`  | The request is fine but the current state is in the way, such as a used-up submission limit. |
| `422`  | The values are invalid. Changing the input could make it succeed.                            |
| `500`  | Something went wrong on our side. Nothing a client sent should ever cause this.              |

Every route can return `401` and `404` for an unknown school, so the route reference only lists the errors
specific to each.
