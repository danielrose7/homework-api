import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { fieldsOf } from "@/app/docs/_lib/fields";
import { API_ROUTES, ROUTE_DOCS } from "@/app/docs/_lib/registry";

const API_ROOT = "app/api/v1";

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? routeFiles(path)
      : entry.name === "route.ts"
        ? [path]
        : [];
  });
}

const fileFor = (docPath: string) =>
  join("app", docPath.replace(/\{(\w+)\}/g, "[$1]"), "route.ts");

describe("route docs registry", () => {
  it("documents every route file, and only route files", () => {
    const documented = API_ROUTES.map((route) => fileFor(route.doc.path));

    expect([...documented].sort()).toEqual(routeFiles(API_ROOT).sort());
  });

  it("names the verb the route file exports", () => {
    for (const { doc } of API_ROUTES) {
      const source = readFileSync(fileFor(doc.path), "utf8");

      expect(source, doc.id).toMatch(
        new RegExp(`export const ${doc.method} = serve\\(`),
      );
    }
  });

  it("gives every route a unique id and a unique method and path", () => {
    expect(new Set(ROUTE_DOCS.map((doc) => doc.id)).size).toBe(
      ROUTE_DOCS.length,
    );
    expect(
      new Set(ROUTE_DOCS.map((doc) => `${doc.method} ${doc.path}`)).size,
    ).toBe(ROUTE_DOCS.length);
  });

  it("describes exactly the path parameters in the path", () => {
    for (const doc of API_ROUTES.map((route) => route.doc)) {
      const placeholders = [...doc.path.matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .filter((name) => name !== "org_slug");
      const described = doc.params ? fieldsOf(doc.params) : [];

      expect(
        described.map((field) => field.name),
        doc.id,
      ).toEqual(placeholders);
    }
  });

  it("describes every parameter, query field and body field", () => {
    const schemas: Array<{ label: string; schema: z.ZodType }> = [];
    for (const doc of ROUTE_DOCS) {
      if (doc.params)
        schemas.push({ label: `${doc.id} params`, schema: doc.params });
      if (doc.query)
        schemas.push({ label: `${doc.id} query`, schema: doc.query });
      for (const body of doc.bodies ?? []) {
        schemas.push({
          label: `${doc.id} ${body.content_type}`,
          schema: body.schema,
        });
      }
    }

    for (const { label, schema } of schemas) {
      for (const field of fieldsOf(schema)) {
        expect(field.description, `${label}: ${field.name}`).not.toBe("");
      }
    }
  });

  it("lists a body only on routes that write", () => {
    for (const doc of ROUTE_DOCS) {
      expect(Boolean(doc.bodies), doc.id).toBe(doc.method !== "GET");
    }
  });

  it("points the route files at paths that exist", () => {
    for (const { doc } of API_ROUTES) {
      expect(existsSync(fileFor(doc.path)), doc.id).toBe(true);
    }
  });
});
