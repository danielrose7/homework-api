A student hands in work for an assignment in one of their classes, as written text, files, or both.

## Find the assignment

Ids are different in every database, and there is no endpoint that lists assignments. In the Sandbox school the
[sandbox console](/sandbox/console) offers each assignment in a picker; put the one you choose in `ASSIGNMENT_ID`.

## Submit text

Send JSON with `text`. The reply is the new submission with a `201` and a `Location` header pointing at it.

```example
submit | Submit text
```

## Submit text and a file

For files, send `multipart/form-data` with `text` and one `files` field per file. Allowed types and size limits are
on the [route reference](/docs/api/submit). Attachments cannot be added after submitting.

```example
submit | Submit text and a file
```

## When it does not work

An assignment allows one submission by default, so a second try is a `409` with the code
`submission_limit_reached`:

```example
submit | Submit again
```

Missing or invalid content is a `422` that lists every problem at once:

```example
submit | Blank text
```

See [Errors](/docs/errors) for the shape these share.

## See what you have handed in

```example
list_own | List my submissions
```

Filter by `grade` (`A` to `F`, `incomplete` or `ungraded`) and by `assignment` name:

```example
list_own | Filter by grade and assignment
```
