Teachers see every submission in the classes they teach and grade them with points or, for pass/fail work, a band.
Administrators can do the same across the school.

## See what is waiting

The overview filters by assignment name, a date range and student name. Dates are calendar days in the school's
time zone, both ends included.

```example
list_overview | Filter by student and date
```

Students cannot use this route; they get a `403`:

```example
list_overview | A student is refused
```

## Grade a submission

`PUT` replaces the current grade, so repeating the same request changes nothing. Send `points` for work graded by
points, or `band` for work graded by band (such as `Pass`), plus optional `teacher_notes`. A teacher can send `band: "Incomplete"` on any assignment, including pass/fail work,
when a submission is not ready to be marked.

```example
grade | Grade with points
```

The grade the school's scale produced (label, group, percent and the scale used) is stored with the submission, so
editing a scale later never relabels past work.

## Regrade

Repeating the current grade and teacher notes is an idempotent no-op. Replacing either with something different needs
a `reason`. Without one, the request is a `422` with the code `reason_required`:

```example
grade | Regrade without a reason
```

```example
grade | Regrade with a reason
```

Every change is kept in the submission's grade history, and a regrade is last-write-wins. The history is not yet
readable over the API.
