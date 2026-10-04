import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  bytesMatchContentType,
  sanitizeFilename,
  validateUpload,
} from "../uploads";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);
const codes = (input: Parameters<typeof validateUpload>[0]) =>
  validateUpload(input).map((i) => i.code);

describe("sanitizeFilename", () => {
  it("keeps only the last path segment and strips control characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\essay.docx")).toBe("essay.docx");
    expect(sanitizeFilename("ess\u0000ay\n.txt")).toBe("essay.txt");
    expect(sanitizeFilename("  report.pdf  ")).toBe("report.pdf");
    expect(sanitizeFilename("a".repeat(400))).toHaveLength(255);
    expect(sanitizeFilename("../")).toBe("");
  });
});

describe("bytesMatchContentType", () => {
  it("recognises real signatures", () => {
    expect(bytesMatchContentType("application/pdf", text("%PDF-1.7 ..."))).toBe(
      true,
    );
    expect(
      bytesMatchContentType(
        "image/png",
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1),
      ),
    ).toBe(true);
    expect(
      bytesMatchContentType("image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0)),
    ).toBe(true);
    expect(bytesMatchContentType("image/gif", text("GIF89a...."))).toBe(true);
    expect(
      bytesMatchContentType("application/zip", bytes(0x50, 0x4b, 0x03, 0x04)),
    ).toBe(true);
  });

  it("recognises WebP, HEIC, HEIF and AVIF", () => {
    expect(
      bytesMatchContentType(
        "image/webp",
        text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "),
      ),
    ).toBe(true);
    expect(
      bytesMatchContentType(
        "image/heic",
        text("\u0000\u0000\u0000\u0018ftypheic"),
      ),
    ).toBe(true);
    expect(
      bytesMatchContentType(
        "image/heif",
        text("\u0000\u0000\u0000\u0018ftypmif1"),
      ),
    ).toBe(true);
    expect(
      bytesMatchContentType(
        "image/avif",
        text("\u0000\u0000\u0000\u0018ftypavif"),
      ),
    ).toBe(true);
    expect(bytesMatchContentType("image/webp", text("RIFF....WAVE"))).toBe(
      false,
    );
    expect(bytesMatchContentType("image/heic", text("....ftypavif"))).toBe(
      false,
    );
  });

  it("rejects mislabelled files", () => {
    expect(bytesMatchContentType("application/pdf", text("<html>"))).toBe(
      false,
    );
    expect(bytesMatchContentType("image/png", bytes(0xff, 0xd8, 0xff))).toBe(
      false,
    );
    expect(bytesMatchContentType("application/zip", text("not a zip"))).toBe(
      false,
    );
  });

  it("accepts plain text only when it is valid UTF-8 without NUL bytes", () => {
    expect(bytesMatchContentType("text/plain", text("héllo wörld"))).toBe(true);
    expect(bytesMatchContentType("text/csv", text("a,b\n1,2"))).toBe(true);
    expect(bytesMatchContentType("text/plain", bytes(0x68, 0x00, 0x69))).toBe(
      false,
    );
    expect(bytesMatchContentType("text/plain", bytes(0xff, 0xfe, 0xfd))).toBe(
      false,
    );
  });
});

describe("validateUpload", () => {
  const good = {
    filename: "essay.txt",
    contentType: "text/plain",
    bytes: text("hello"),
  };

  it("accepts a normal file", () => {
    expect(validateUpload(good)).toEqual([]);
  });

  it("requires a file name", () => {
    expect(codes({ ...good, filename: "../" })).toEqual(["filename_required"]);
  });

  it("rejects empty and oversized files", () => {
    expect(codes({ ...good, bytes: new Uint8Array() })).toEqual(["file_empty"]);
    expect(
      codes({ ...good, bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1).fill(97) }),
    ).toEqual(["file_too_large"]);
    expect(
      codes({ ...good, bytes: new Uint8Array(MAX_UPLOAD_BYTES).fill(97) }),
    ).toEqual([]);
  });

  it("rejects types outside the allow-list and files that lie about their type", () => {
    expect(codes({ ...good, contentType: "application/x-msdownload" })).toEqual(
      ["content_type_not_allowed"],
    );
    expect(codes({ ...good, contentType: "application/pdf" })).toEqual([
      "content_type_mismatch",
    ]);
  });

  it("reports everything at once", () => {
    expect(
      codes({
        filename: "",
        contentType: "image/png",
        bytes: new Uint8Array(),
      }).sort(),
    ).toEqual(["file_empty", "filename_required"]);
  });
});
