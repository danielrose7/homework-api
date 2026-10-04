import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const API_ROOT = "app/api/v1";
const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? filesUnder(path)
      : entry.name === "route.ts"
        ? [path]
        : [];
  });
}

function zodObjectKeys(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const keys: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "z" &&
      ["object", "strictObject"].includes(node.expression.name.text)
    ) {
      const shape = node.arguments[0];
      if (shape && ts.isObjectLiteralExpression(shape)) {
        for (const property of shape.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          if (
            ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name)
          ) {
            keys.push(property.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return keys;
}

const routes = filesUnder(API_ROOT);

describe("route naming conventions", () => {
  it("uses snake_case dynamic segment names", () => {
    for (const path of routes) {
      for (const segment of path.matchAll(/\[([^.[\]]+)]/g)) {
        expect(segment[1], relative(API_ROOT, path)).toMatch(SNAKE_CASE);
      }
    }
  });

  it("uses snake_case fields in route Zod object schemas", () => {
    for (const path of routes) {
      for (const key of zodObjectKeys(path)) {
        expect(key, `${relative(API_ROOT, path)}: ${key}`).toMatch(SNAKE_CASE);
      }
    }
  });
});
