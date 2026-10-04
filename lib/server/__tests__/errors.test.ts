import { describe, expect, it } from "vitest";

import { errorBody, validationFailed, wireField } from "@/lib/server/errors";

describe("wireField", () => {
  it("snake_cases each segment of a path and leaves wire names alone", () => {
    expect(wireField("teacherNotes")).toBe("teacher_notes");
    expect(wireField("files.1.contentType")).toBe("files.1.content_type");
    expect(wireField("bands.0.minPercent")).toBe("bands.0.min_percent");
    expect(wireField("page_size")).toBe("page_size");
    expect(wireField("")).toBe("");
  });
});

describe("errorBody", () => {
  it("reports issue fields by their wire names", () => {
    const body = errorBody(
      validationFailed([
        { field: "maxPoints", code: "too_large", message: "Too large" },
      ]),
    );

    expect(body.error.details).toEqual([
      { field: "max_points", code: "too_large", message: "Too large" },
    ]);
  });
});
