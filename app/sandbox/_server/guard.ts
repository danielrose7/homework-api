import { STATUS } from "@/lib/http-status";
import { errorBody, notFound } from "@/lib/server/errors";

export const sandboxEnabled = () => process.env.SANDBOX_MODE === "true";

/** Dev routes answer an ordinary 404 unless SANDBOX_MODE is on, so they cannot exist in a real deployment by accident. */
export function sandboxDisabledResponse() {
  return Response.json(errorBody(notFound()), { status: STATUS.not_found });
}
