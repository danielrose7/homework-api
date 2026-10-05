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
