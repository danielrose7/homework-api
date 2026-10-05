import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { contentFile } from "@/app/docs/_lib/nav";

export const CONTENT_DIR = join(process.cwd(), "app/docs/_content");

export const contentPath = (slug: string) =>
  join(CONTENT_DIR, `${contentFile(slug)}.md`);

export function readContent(slug: string): Promise<string> {
  return readFile(contentPath(slug), "utf8");
}

export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Second- and third-level headings outside code fences, for the "On this page" rail. */
export function headingsOf(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    const match = fenced ? null : /^(#{2,3}) (.+)$/.exec(line);
    if (!match) continue;
    const text = (match[2] ?? "").replace(/`/g, "");
    headings.push({
      id: headingId(text),
      text,
      level: match[1]?.length === 2 ? 2 : 3,
    });
  }
  return headings;
}
