Homework API is a small system of record for school homework: students hand work in and see how it was graded,
teachers see everything handed in and grade it. It was built as a take-home for Stride, and the whole surface is
a plain REST API with JSON bodies, so curl, Python and Node all talk to it the same way.

## What it does

- **Students** submit homework as text, files, or both; list their own submissions; filter them by grade (`A` to
  `F`, `incomplete`, `ungraded`) and by assignment name.
- **Teachers** get an overview of every submission in the classes they teach, filter it by assignment name, a
  date range and student name, and grade a submission with points or a band plus teacher notes.
- **Administrators** can do everything a teacher can, across the whole school.

A submission carries the assignment, the student, when it was submitted and graded, the final grade and the
teacher notes. Every regrade needs a reason, and the earlier grades are kept in a history (not yet readable over
the API).
