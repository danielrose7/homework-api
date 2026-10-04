import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");

interface ParsedModel {
  name: string;
  fields: Map<string, string>;
  attributes: string[];
}

function parseModels(source: string): ParsedModel[] {
  const models: ParsedModel[] = [];
  for (const match of source.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const [, name, body] = match;
    if (!name || !body) continue;
    const fields = new Map<string, string>();
    const attributes: string[] = [];
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//")) continue;
      if (line.startsWith("@@")) {
        attributes.push(line);
        continue;
      }
      const [field, ...rest] = line.split(/\s+/);
      if (field) fields.set(field, rest.join(" "));
    }
    models.push({ name, fields, attributes });
  }
  return models;
}

const models = parseModels(schema);

const APPEND_ONLY = new Set(["ActivityLog", "SubmissionGradeEvent"]);
const BETTER_AUTH_OWNED = new Set(["Member", "Invitation"]);
const GLOBAL = new Set([
  "User",
  "Session",
  "Account",
  "Verification",
  "Organization",
]);

describe("schema conventions", () => {
  it("finds models to check", () => {
    expect(models.length).toBeGreaterThan(0);
  });

  describe.each(models.map((model) => [model.name, model] as const))(
    "%s",
    (name, model) => {
      it("uses a UUIDv7 primary key", () => {
        const id = model.fields.get("id") ?? "";
        expect(id).toContain("@id");
        expect(id).toContain("@default(uuid(7))");
        expect(id).toContain("@db.Uuid");
      });

      it("has created_at defaulting to now()", () => {
        const createdAt = model.fields.get("createdAt") ?? "";
        expect(createdAt).toContain("@default(now())");
        expect(createdAt).toContain('@map("created_at")');
      });

      it("has updated_at maintained by the Prisma client, unless append-only", () => {
        const updatedAt = model.fields.get("updatedAt");
        if (APPEND_ONLY.has(name)) {
          expect(updatedAt).toBeUndefined();
          return;
        }
        expect(updatedAt).toBeDefined();
        expect(updatedAt).toContain("@default(now())");
        expect(updatedAt).toContain("@updatedAt");
        expect(updatedAt).toContain('@map("updated_at")');
      });

      it("stores every instant as Timestamptz(3) and calendar days as Date", () => {
        for (const [field, definition] of model.fields) {
          if (!/^DateTime\??(\s|$)/.test(definition)) continue;
          const calendarDay = field.endsWith("On");
          expect(definition, `${name}.${field}`).toContain(
            calendarDay ? "@db.Date" : "@db.Timestamptz(3)",
          );
        }
      });

      it("keeps foreign keys from cascading", () => {
        if (GLOBAL.has(name) || BETTER_AUTH_OWNED.has(name)) return;
        for (const [field, definition] of model.fields) {
          if (
            definition.includes("@relation(") &&
            definition.includes("onDelete:")
          ) {
            expect(definition, `${name}.${field}`).toContain(
              "onDelete: Restrict",
            );
          }
        }
      });

      it("maps to a snake_case table", () => {
        expect(model.attributes.some((a) => a.startsWith("@@map("))).toBe(true);
      });

      it("is scoped by organization_id unless global", () => {
        if (GLOBAL.has(name)) return;
        const organizationId = model.fields.get("organizationId") ?? "";
        expect(organizationId).toContain('@map("organization_id")');
        expect(organizationId).toContain("@db.Uuid");
      });
    },
  );
});
