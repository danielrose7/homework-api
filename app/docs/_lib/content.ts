import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const CONTENT_DIR = join(process.cwd(), "app/docs/_content");

export function readContent(name: string): Promise<string> {
  return readFile(join(CONTENT_DIR, `${name}.md`), "utf8");
}
