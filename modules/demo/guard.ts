import { STATUS } from "@/lib/http-status";
import { errorBody, notFound } from "@/lib/server/errors";

export const demoModeEnabled = () => process.env.DEMO_MODE === "true";

/** Dev routes answer an ordinary 404 unless DEMO_MODE is on, so they cannot exist in a real deployment by accident. */
export function demoDisabledResponse() {
  return Response.json(errorBody(notFound()), { status: STATUS.not_found });
}
