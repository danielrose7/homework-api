"use server";

import { sandboxEnabled } from "@/app/sandbox/_server/guard";
import {
  readPersonaContext,
  type PersonaContext,
} from "@/app/sandbox/_server/queries/read-persona-context";

export async function loadPersonaContext(
  username: string,
): Promise<PersonaContext | null> {
  if (!sandboxEnabled()) return null;
  return readPersonaContext(username);
}
