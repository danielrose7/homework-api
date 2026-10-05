- JSON bodies and responses use `snake_case` field names.
- Every resource has an `object` field naming its type, such as `"submission"`, and an `id`.
- Timestamps are ISO 8601 with an offset, such as `2026-10-02T14:03:11.482Z`.
- Dates in filters (`from`, `to`) are calendar days read in the **school's time zone**, not UTC, and both ends are
  inclusive.
- Every response has an `x-request-id` header; quote it when reporting a problem.
