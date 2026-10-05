Everything lives inside a school (an _organization_). A request names its school in the path, as
`/api/v1/orgs/{org_slug}/…`, and a person's role in that school decides what they may do. Roles are `student`,
`teacher` and `administrator`. A school's data is invisible from another school: asking for it is a `404`, the same
as asking for something that does not exist.

Grading scales are data, not code. A school has a default scale (the standard `A` to `F`), and a class or an
assignment can use another, such as plus/minus letters or pass/fail. The grade a submission earned is stored with it
when it is graded, so editing a scale later never relabels past work.
