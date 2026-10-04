import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const PREFIX = "https://github.com/danielrose7/homework-api/";

describe("codebase guide", () => {
  it("links only to files and folders that exist", () => {
    const source = readFileSync("app/docs/_content/codebase.md", "utf8");
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
