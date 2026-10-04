export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface SubmittedCursor {
  submittedAt: Date;
  id: string;
}

export function encodeCursor(cursor: SubmittedCursor): string {
  return Buffer.from(
    `${cursor.submittedAt.toISOString()}|${cursor.id}`,
  ).toString("base64url");
}

/** Null when the text is not a cursor this API produced. */
export function decodeCursor(text: string): SubmittedCursor | null {
  const [instant, id, ...rest] = Buffer.from(text, "base64url")
    .toString("utf8")
    .split("|");
  if (!instant || !id || rest.length > 0) return null;
  const submittedAt = new Date(instant);
  if (Number.isNaN(submittedAt.getTime())) return null;
  return { submittedAt, id };
}
