import Link from "next/link";

import {
  BROWSABLE_TABLES,
  isBrowsableTable,
  listTables,
  readTable,
} from "@/modules/demo/queries/read-tables";
import { DataGrid } from "@/app/sandbox/data/_components/data-grid";
import { cn } from "@/lib/utils";

const NOTES: Record<string, string> = {
  activity_log:
    "IDs only: no names, notes or grade contents. Denials appear for 403s and deliberate 404s.",
  submission_grade_event:
    "Append-only. A regrade adds a row and keeps the old one.",
};

export default async function DataPage({
  searchParams,
}: PageProps<"/sandbox/data">) {
  const { table: requested } = await searchParams;
  const name =
    typeof requested === "string" && isBrowsableTable(requested)
      ? requested
      : BROWSABLE_TABLES[0];
  const [tables, data] = await Promise.all([
    listTables(),
    readTable(name, 200),
  ]);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[14.5rem_minmax(0,1fr)]">
      <nav
        aria-label="Tables"
        className="bg-card max-h-48 overflow-auto border-b py-2.5 md:max-h-none md:border-r md:border-b-0"
      >
        <div className="text-muted-foreground mb-2 border-b px-3.5 pb-2.5 text-[11px]">
          connection <b className="text-foreground">owner</b> · read-only
          <br />
          db <b className="text-foreground">homework</b> · schema{" "}
          <b className="text-foreground">public</b>
        </div>
        {tables.map((entry) => (
          <Link
            key={entry.name}
            href={`/sandbox/data?table=${entry.name}`}
            aria-current={entry.name === name}
            className={cn(
              "hover:bg-muted flex items-baseline gap-2 px-3.5 py-1",
              entry.name === name && "bg-accent",
            )}
          >
            {entry.name}
            <span className="text-muted-foreground ml-auto">{entry.count}</span>
          </Link>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="bg-card flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
          <b>{data.table}</b>
          <span className="text-muted-foreground">
            {data.rows.length} of {data.count} rows, newest first
          </span>
          <span className="text-muted-foreground">
            {NOTES[data.table] ?? "Live view of the rows behind the API."}
          </span>
        </div>
        <DataGrid columns={data.columns} rows={data.rows} />
      </div>
    </div>
  );
}
