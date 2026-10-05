Sign in with a username and password, then send the token that comes back with every request.

1. `POST /api/auth/sign-in/username` with `{ "username", "password" }`. The reply has the token in its `token`
   field and in a `set-auth-token` header.
2. Send it as `Authorization: Bearer <token>`. The examples keep it in a `TOKEN` environment variable.
3. Name the school in the path: `/api/v1/orgs/sandbox/…`.

Each request checks, in this order, who you are, whether you belong to that school, and whether your role may do
the thing:

| Status | When                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| `401`  | No token, or one that is not valid.                                                       |
| `404`  | The school does not exist, you are not a member of it, or the record is not yours to see. |
| `403`  | You are a member of the school, but your role cannot do this.                             |

A student asking for another student's submission gets a `404`, not a `403`, so the API never confirms that a
record exists to someone who may not see it.

Sign-in, and creating a school, are handled by [Better Auth](https://better-auth.com) under `/api/auth/*`.
There are no endpoints for adding people to a school; the seed creates them.
