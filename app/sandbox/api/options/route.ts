import {
  sandboxDisabledResponse,
  sandboxEnabled,
} from "@/app/sandbox/_server/guard";
import { readSandboxOptions } from "@/app/sandbox/_server/queries/read-options";

export async function GET() {
  if (!sandboxEnabled()) return sandboxDisabledResponse();
  return Response.json(await readSandboxOptions());
}
