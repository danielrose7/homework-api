import { z } from "zod";

type JsonSchema = z.core.JSONSchema.BaseSchema;

export interface FieldDoc {
  name: string;
  type: string;
  required: boolean;
  default: string | null;
  description: string;
  constraints: string[];
}

function typeLabel(schema: JsonSchema): string {
  if (schema.format === "binary") return "file";
  if (schema.enum) return schema.enum.map((value) => `"${value}"`).join(" | ");
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const labels = types.map((type) => {
    if (type === "array") {
      const items = Array.isArray(schema.items)
        ? schema.items[0]
        : schema.items;
      return `${items && typeof items === "object" ? typeLabel(items) : "any"}[]`;
    }
    return type ?? "any";
  });
  const label = labels.join(" | ");
  return schema.format && schema.format !== "binary"
    ? `${label} (${schema.format})`
    : label;
}

function constraintsOf(schema: JsonSchema): string[] {
  const constraints: string[] = [];
  if (schema.minLength !== undefined)
    constraints.push(`min length ${schema.minLength}`);
  if (schema.maxLength !== undefined)
    constraints.push(`max length ${schema.maxLength}`);
  if (schema.minimum !== undefined) constraints.push(`min ${schema.minimum}`);
  if (schema.maximum !== undefined) constraints.push(`max ${schema.maximum}`);
  return constraints;
}

/** A file field has no JSON Schema form of its own, so it is described as a binary string. */
function toJsonSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type === "custom") {
        jsonSchema.type = "string";
        jsonSchema.format = "binary";
      }
    },
  });
}

/** One row per top-level property of an object schema, in the order the schema declares them. */
export function fieldsOf(schema: z.ZodType): FieldDoc[] {
  const json = toJsonSchema(schema);
  const required = new Set(json.required ?? []);
  return Object.entries(json.properties ?? {}).map(([name, property]) => {
    const field = typeof property === "object" ? property : {};
    return {
      name,
      type: typeLabel(field),
      required: required.has(name),
      default: field.default === undefined ? null : String(field.default),
      description: field.description ?? "",
      constraints: constraintsOf(field),
    };
  });
}
