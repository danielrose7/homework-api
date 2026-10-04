import { z } from "zod";

import { STATUS } from "@/lib/http-status";

import type { RouteDoc } from "@/lib/server/route-doc";

const signInBody = z.object({
  username: z.string().describe("The person's username, such as `maya`."),
  password: z.string().describe("Their password."),
});

/** Better Auth serves this route; the entry exists so the docs and the console can describe it like the rest. */
export const signInDoc: RouteDoc = {
  id: "sign_in",
  method: "POST",
  path: "/api/auth/sign-in/username",
  group: "Auth",
  title: "Sign in",
  summary:
    "Exchange a username and password for a bearer token; a wrong password is a 401.",
  description:
    "The token is in the `token` field of the body and in the `set-auth-token` response header. Send it as `Authorization: Bearer <token>` on every other request. Errors use Better Auth's own shape, `{ code, message }`, not the API's error object.",
  roles: "public",
  bodies: [{ content_type: "application/json", schema: signInBody }],
  success: {
    status: STATUS.ok,
    description: "`{ token, user }`.",
  },
  errors: [
    {
      status: STATUS.unauthorized,
      code: "INVALID_USERNAME_OR_PASSWORD",
      description: "No such username, or the password is wrong.",
    },
  ],
};
