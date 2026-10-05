A tour of the code and the decisions behind it. Links go to the files on
[`main`](https://github.com/danielrose7/homework-api). The full plan, with every decision and its reasons, is in
[`docs/plan/README.md`](https://github.com/danielrose7/homework-api/blob/main/docs/plan/README.md).

## Layout

| Where                                                                                                | What lives there                                                         |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`app/api/v1`](https://github.com/danielrose7/homework-api/tree/main/app/api/v1)                     | One `route.ts` per URL: its Zod schemas, its docs entry and its handler. |
| [`modules/`](https://github.com/danielrose7/homework-api/tree/main/modules)                          | Behavior by resource: `queries`, `mutations` and `serializers.ts`.       |
| [`lib/domain/`](https://github.com/danielrose7/homework-api/tree/main/lib/domain)                    | Pure rules with no database: grading, eligibility, filters, validation.  |
| [`lib/server/`](https://github.com/danielrose7/homework-api/tree/main/lib/server)                    | Request context, errors, the route wrapper, auth and database plumbing.  |
| [`app/docs/_lib/`](https://github.com/danielrose7/homework-api/tree/main/app/docs/_lib)              | The route registry and the example generators behind these docs.         |
| [`prisma/schema.prisma`](https://github.com/danielrose7/homework-api/blob/main/prisma/schema.prisma) | The data model.                                                          |
| [`app/sandbox/`](https://github.com/danielrose7/homework-api/tree/main/app/sandbox)                  | The demo UI, the seed and the reset button.                              |
| [`test/`](https://github.com/danielrose7/homework-api/tree/main/test)                                | Integration tests, factories and scenario helpers.                       |

[`docs/architecture.md`](https://github.com/danielrose7/homework-api/blob/main/docs/architecture.md) explains the
dependency direction: a route handler calls one query or mutation, which uses domain rules, and a serializer shapes
the response.
