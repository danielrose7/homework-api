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
const AUTH_MODELS = new Set([
  "User",
  "Session",
  "Account",
  "Verification",
  "Organization",
  "Member",
  "Invitation",
]);
const BETTER_AUTH_CASCADE = new Set(["Member", "Invitation"]);
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
        const created_at =
          model.fields.get(
            AUTH_MODELS.has(name) ? "createdAt" : "created_at",
          ) ?? "";
        expect(created_at).toContain("@default(now())");
        expect(created_at).toContain('@map("created_at")');
      });

      it("has updated_at maintained by the Prisma client, unless append-only", () => {
        const updated_at = model.fields.get(
          AUTH_MODELS.has(name) ? "updatedAt" : "updated_at",
        );
        if (APPEND_ONLY.has(name)) {
          expect(updated_at).toBeUndefined();
          return;
        }
        expect(updated_at).toBeDefined();
        expect(updated_at).toContain("@default(now())");
        expect(updated_at).toContain("@updatedAt");
        expect(updated_at).toContain('@map("updated_at")');
      });

      it("stores every instant as Timestamptz(3) and calendar days as Date", () => {
        for (const [field, definition] of model.fields) {
          if (!/^DateTime\??(\s|$)/.test(definition)) continue;
          const calendarDay = field.endsWith("_on");
          expect(definition, `${name}.${field}`).toContain(
            calendarDay ? "@db.Date" : "@db.Timestamptz(3)",
          );
        }
      });

      it("keeps foreign keys from cascading", () => {
        if (GLOBAL.has(name) || BETTER_AUTH_CASCADE.has(name)) return;
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

      it("names every pointer to another row with an _id suffix", () => {
        if (AUTH_MODELS.has(name)) return;
        for (const [field, definition] of model.fields) {
          if (field === "id" || !definition.includes("@db.Uuid")) continue;
          expect(
            field.endsWith("_id"),
            `${name}.${field} should end in _id`,
          ).toBe(true);
          expect(definition, `${name}.${field}`).toMatch(
            /@map\("[a-z_]+_id"\)/,
          );
        }
      });

      it("names a relation after its column without the Id suffix", () => {
        for (const [field, definition] of model.fields) {
          const relation = definition.match(
            /@relation\((?:"\w+",\s*)?fields: \[([^\]]+)\]/,
          );
          if (!relation?.[1]) continue;
          const pointer =
            relation[1]
              .split(",")
              .map((part) => part.trim())
              .at(-1) ?? "";
          if (pointer === "organization_id" || !pointer.endsWith("_id"))
            continue;
          expect(
            field,
            `${name}.${field} relates through ${pointer}`,
          ).not.toMatch(/_id$/);
        }
      });

      it("maps to a snake_case table", () => {
        expect(model.attributes.some((a) => a.startsWith("@@map("))).toBe(true);
      });

      it("is scoped by organization_id unless global", () => {
        if (GLOBAL.has(name)) return;
        const organization_id =
          model.fields.get(
            AUTH_MODELS.has(name) ? "organizationId" : "organization_id",
          ) ?? "";
        expect(organization_id).toContain('@map("organization_id")');
        expect(organization_id).toContain("@db.Uuid");
      });
    },
  );
});
