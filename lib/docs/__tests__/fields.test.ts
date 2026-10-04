import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldsOf } from "@/lib/docs/fields";

describe("fieldsOf", () => {
  it("describes types, requiredness, defaults, constraints and descriptions", () => {
    const fields = fieldsOf(
      z.strictObject({
        id: z.uuid().describe("The id."),
        name: z.string().min(2).max(10).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        day: z.iso.date().optional(),
      }),
    );

    expect(fields).toEqual([
      {
        name: "id",
        type: "string (uuid)",
        required: true,
        default: null,
        description: "The id.",
        constraints: [],
      },
      {
        name: "name",
        type: "string",
        required: false,
        default: null,
        description: "",
        constraints: ["min length 2", "max length 10"],
      },
      {
        name: "limit",
        type: "integer",
        required: false,
        default: "25",
        description: "",
        constraints: ["min 1", "max 100"],
      },
      {
        name: "day",
        type: "string (date)",
        required: false,
        default: null,
        description: "",
        constraints: [],
      },
    ]);
  });

  it("shows unions and nullable fields as alternatives", () => {
    const [points, band] = fieldsOf(
      z.object({
        points: z.union([z.string(), z.number()]).transform(String).nullish(),
        band: z.string().nullish(),
      }),
    );

    expect(points?.type).toBe("string | number | null");
    expect(points?.required).toBe(false);
    expect(band?.type).toBe("string | null");
  });

  it("shows uploaded files as file lists", () => {
    const [files] = fieldsOf(z.object({ files: z.array(z.instanceof(File)) }));

    expect(files).toMatchObject({
      name: "files",
      type: "file[]",
      required: true,
    });
  });
});
