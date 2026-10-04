import { PEOPLE } from "@/modules/demo/seed-data";

export { PEOPLE };

export const roleOf = (username: string | null) =>
  PEOPLE.find((person) => person.username === username)?.role ?? null;

export const DEFAULT_PERSONA = "alvarez";
