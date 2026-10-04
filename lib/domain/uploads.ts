import { issue, type ValidationIssue } from "./validation";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_FILES_PER_RECORD = 5;

const ALLOWED_CONTENT_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  signature.every((value, index) => bytes[index] === value);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

const HEIF_BRANDS: Record<string, readonly string[]> = {
  "image/heic": ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1"],
  "image/heif": [
    "heic",
    "heix",
    "heim",
    "heis",
    "hevc",
    "hevx",
    "mif1",
    "msf1",
  ],
  "image/avif": ["avif", "avis", "mif1"],
};

const hasIsoBrand = (bytes: Uint8Array, brands: readonly string[]) =>
  startsWith(bytes.subarray(4, 8), ascii("ftyp")) &&
  brands.some((brand) => startsWith(bytes.subarray(8), ascii(brand)));

function isUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Whether the bytes plausibly match the declared type. Types without a signature are not second-guessed. */
export function bytesMatchContentType(
  content_type: string,
  bytes: Uint8Array,
): boolean {
  switch (content_type) {
    case "application/pdf":
      return startsWith(bytes, ascii("%PDF-"));
    case "image/png":
      return startsWith(
        bytes,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return (
        startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))
      );
    case "image/webp":
      return (
        startsWith(bytes, ascii("RIFF")) &&
        startsWith(bytes.subarray(8), ascii("WEBP"))
      );
    case "image/heic":
    case "image/heif":
    case "image/avif":
      return hasIsoBrand(bytes, HEIF_BRANDS[content_type] ?? []);
    case "application/zip":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case "text/plain":
    case "text/markdown":
    case "text/csv":
      return isUtf8Text(bytes);
    default:
      return true;
  }
}

/** Keeps the final path segment, strips control characters and caps the length. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.slice(0, 255);
}

export interface UploadInput {
  filename: string;
  content_type: string;
  bytes: Uint8Array;
}

export function validateUpload(input: UploadInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!sanitizeFilename(input.filename)) {
    issues.push(
      issue("filename", "filename_required", "A file name is required"),
    );
  }
  if (input.bytes.length === 0) {
    issues.push(issue("file", "file_empty", "The file is empty"));
  } else if (input.bytes.length > MAX_UPLOAD_BYTES) {
    issues.push(
      issue(
        "file",
        "file_too_large",
        `Files can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
      ),
    );
  }

  const allowed = (ALLOWED_CONTENT_TYPES as readonly string[]).includes(
    input.content_type,
  );
  if (!allowed) {
    issues.push(
      issue(
        "content_type",
        "content_type_not_allowed",
        `${input.content_type || "That type"} is not accepted`,
      ),
    );
  } else if (
    input.bytes.length > 0 &&
    !bytesMatchContentType(input.content_type, input.bytes)
  ) {
    issues.push(
      issue(
        "file",
        "content_type_mismatch",
        "The file contents do not match its type",
      ),
    );
  }
  return issues;
}
