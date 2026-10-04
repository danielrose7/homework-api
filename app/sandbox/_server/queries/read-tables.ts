import { ownerPool } from "@/app/sandbox/_server/owner-pool";

export const BROWSABLE_TABLES = [
  "assignment_submission",
  "submission_grade_event",
  "activity_log",
  "assignment",
  "class",
  "class_seat",
  "member",
] as const;

export type BrowsableTable = (typeof BROWSABLE_TABLES)[number];

export const isBrowsableTable = (name: string): name is BrowsableTable =>
  (BROWSABLE_TABLES as readonly string[]).includes(name);

export async function listTables() {
  const pool = ownerPool();
  const tables = [];
  for (const name of BROWSABLE_TABLES) {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*) FROM "${name}"`,
    );
    tables.push({ name, count: Number(rows[0]?.count ?? 0) });
  }
  return tables;
}

export async function readTable(name: BrowsableTable, limit: number) {
  const pool = ownerPool();
  const columns = await pool.query<{ name: string; type: string }>(
    `SELECT column_name AS name, data_type AS type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [name],
  );
  const rows = await pool.query(
    `SELECT * FROM "${name}" ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit],
  );
  const total = await pool.query<{ count: string }>(
    `SELECT count(*) FROM "${name}"`,
  );
  return {
    table: name,
    count: Number(total.rows[0]?.count ?? 0),
    columns: columns.rows,
    rows: rows.rows,
  };
}
