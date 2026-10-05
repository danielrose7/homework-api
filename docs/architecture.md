# Application structure

Organize application code by domain module so a reader can find behavior from the resource name without knowing the
whole call graph. The layout borrows Django's app boundaries and serializer terminology, and Rails' query/service
objects, while keeping Next.js route handlers visible in the filesystem routes that own them.

```text
app/api/...
modules/
  submissions/
    queries/
    mutations/
    serializers.ts
    types.ts
    utils/
lib/
  domain/
  server/
```

This is an incremental migration. Code that has not moved into a module remains under `lib/`; move one coherent
module at a time instead of introducing compatibility barrels or changing every import at once.

## Route handlers

Each `app/api/**/route.ts` file is the controller for that URL. Keep its parameter, query and body Zod schemas there,
along with the HTTP status, headers and response construction. A reader who opens the filesystem route should be able
to see the endpoint contract and the one primary query or mutation it calls.

Export the route definition separately from the verb wrapped by `serve` so integration tests exercise the same
definition with their transaction-bound dependencies.

## Modules

A module owns application operations and representations for one domain resource or closely related capability.

- `queries/` contains operations whose purpose is to read state. A required access-log write does not turn a read into
  a mutation.
- `mutations/` contains operations whose purpose is to change state. Mutations own their transaction and related audit
  writes when atomicity matters.
- `serializers.ts` maps internal application results to the public API representation. Serializer functions do not
  fetch data and do not stringify JSON.
- `types.ts` holds shared internal result and input types when putting them beside one operation would create a cycle
  or duplication.
- `utils/` holds module-specific helpers shared by queries or mutations, such as the Prisma `where` builders in
  `utils/filter-where.ts`. They take plain inputs and return plain values; they do not fetch data.
- `__tests__/` holds focused query, mutation and route tests for the module. Keep cross-module acceptance, database and
  architecture tests in the top-level `test/` directory.

Name operation files after the action they export, such as `queries/get-submission.ts` and
`mutations/submit-assignment.ts`. Import those files explicitly; do not add barrel `index.ts` files because direct
imports make definitions easier to locate with text search.

Pure rules that do not access the database stay under `lib/domain` until their owning domain module is migrated.
Authentication, database setup, HTTP plumbing and other cross-cutting infrastructure remain outside feature modules.

## Dependency direction

The intended flow is:

```text
route handler -> query or mutation -> domain rules and infrastructure
              -> serializer       -> HTTP response
```

Queries and mutations must not import route handlers. Serializers must not authorize, query the database or write
state. Domain data uses `snake_case` consistently across route parameters, Zod schemas, module inputs and results,
serializer output and audit metadata. Better Auth's owned models and third-party API options keep the spelling their
adapters require. TypeScript function, class and type names retain the language's usual casing.

Do not introduce classes solely to resemble another framework. Small named functions and explicit module boundaries
provide the useful Django/Rails familiarity without hiding dependencies in object construction.
