import { existsSync, readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

const PREFIX = "https://github.com/danielrose7/homework-api/";

const CONTENT = "app/docs/_content";

describe("docs content", () => {
  it("links only to repo files and folders that exist", () => {
    const source = readdirSync(CONTENT)
      .map((name) => readFileSync(`${CONTENT}/${name}`, "utf8"))
      .join("\n");
    const paths = [
      ...source.matchAll(
        /\]\(https:\/\/github\.com\/danielrose7\/homework-api\/(?:blob|tree)\/main\/([^)]+)\)/g,
      ),
    ].map((match) => match[1] ?? "");

    expect(paths.length).toBeGreaterThan(10);
    for (const path of paths) {
      expect(existsSync(path), path).toBe(true);
    }
    expect(source.match(new RegExp(PREFIX, "g"))?.length).toBeGreaterThan(0);
  });
});
