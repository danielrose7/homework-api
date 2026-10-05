import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  contentFile,
  ARCHITECTURE_SECTION,
  CONTENT_SECTIONS,
} from "@/app/docs/_lib/nav";
import { findExample } from "@/app/docs/_components/example-for";

const CONTENT = "app/docs/_content";
const pages = [...CONTENT_SECTIONS, ARCHITECTURE_SECTION].flatMap(
  (section) => section.pages,
);

describe("docs pages", () => {
  it("has a Markdown file for every page in the nav", () => {
    for (const page of pages) {
      expect(
        existsSync(`${CONTENT}/${contentFile(page.slug)}.md`),
        page.slug,
      ).toBe(true);
    }
  });

  it("has no Markdown file the nav does not list", () => {
    const listed = new Set(pages.map((page) => `${contentFile(page.slug)}.md`));
    for (const name of readdirSync(CONTENT)) {
      expect(listed.has(name), name).toBe(true);
    }
  });

  it("embeds only examples that exist", () => {
    for (const name of readdirSync(CONTENT)) {
      const source = readFileSync(`${CONTENT}/${name}`, "utf8");
      for (const match of source.matchAll(/^```example\n(.+?)\n```$/gm)) {
        const [route = "", title = ""] = (match[1] ?? "")
          .split("|")
          .map((piece) => piece.trim());
        expect(
          findExample(route, title),
          `${name}: ${match[1]}`,
        ).not.toBeNull();
      }
    }
  });
});
