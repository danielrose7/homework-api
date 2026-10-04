import { demoDisabledResponse, demoModeEnabled } from "@/modules/demo/guard";
import { readDemoOptions } from "@/modules/demo/queries/read-options";

export async function GET() {
  if (!demoModeEnabled()) return demoDisabledResponse();
  return Response.json(await readDemoOptions());
}
