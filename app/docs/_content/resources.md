## Submission

```json
{
  "id": "0199f1c2-4f63-7a21-9d3e-6b1c0a52e8f4",
  "object": "submission",
  "assignment": {
    "id": "0199f1c2-3a10-7c55-8e02-41d9b7a6c310",
    "title": "Gatsby essay"
  },
  "student": {
    "member_id": "0199f1c2-1b7d-7e90-a4c8-52f0d3e19b67",
    "name": "Maya Brooks",
    "username": "maya"
  },
  "attempt_number": 1,
  "text": "Gatsby's green light is a symbol of a future that keeps receding.",
  "submitted_at": "2026-09-25T15:12:09.114Z",
  "graded_at": "2026-09-27T09:41:52.730Z",
  "teacher_notes": "Strong thesis. Tighten the second paragraph.",
  "grade": {
    "label": "B",
    "group": "B",
    "points_awarded": "84.00",
    "max_points": "100.00",
    "percent": "84.00",
    "scale_id": "0199f1c2-0e44-7b12-b6a1-9c7f2d85a401"
  }
}
```

| Field                        | Meaning                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `student`                    | Who handed it in. `member_id` is their membership in this school.                                           |
| `attempt_number`             | Which try this is. Each assignment allows one by default.                                                   |
| `text`                       | The written answer; `null` when only files were sent.                                                       |
| `graded_at`, `teacher_notes` | `null` until a teacher grades it.                                                                           |
| `grade`                      | `null` until graded.                                                                                        |
| `grade.label`, `grade.group` | What the school's scale called the result, such as `B+` in group `B`, or `Pass`.                            |
| `grade.points_awarded`       | Decimal strings, so no precision is lost. `null`, with `max_points` and `percent`, for work graded by band. |
| `grade.scale_id`             | The scale used. It is kept with the grade even if the school changes its default later.                     |

A submission you have just created also has `attachments`, a list of its files.

## Attachment

```json
{
  "id": "0199f1c4-8d02-7f13-b5e7-0c4a91d3f6b2",
  "object": "attachment",
  "filename": "notes.txt",
  "content_type": "text/plain",
  "byte_size": 33,
  "checksum": "f792353b9d276832edaf65008fc2ea39a4868791fd3aede9114ca22dd82335df"
}
```

Download the bytes from `GET …/submissions/{submission_id}/attachments/{id}`.
