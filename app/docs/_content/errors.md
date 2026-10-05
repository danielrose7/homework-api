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
