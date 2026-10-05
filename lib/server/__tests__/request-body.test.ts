import { describe, expect, it } from "vitest";

import {
  readBodyBytes,
  RequestBodyTooLargeError,
} from "@/lib/server/request-body";

describe("readBodyBytes", () => {
  it("rejects a declared body that is too large without reading it", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-length": "11" },
      body: "small",
    });

    await expect(readBodyBytes(request, 10)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
    expect(request.bodyUsed).toBe(false);
  });

  it("limits a body without a declared length while reading it", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: "eleven-byte",
    });

    await expect(readBodyBytes(request, 10)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("returns a body within the limit", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: "homework",
    });

    expect(new TextDecoder().decode(await readBodyBytes(request, 8))).toBe(
      "homework",
    );
  });
});
