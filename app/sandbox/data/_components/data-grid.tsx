type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function Cell({ value, type }: { value: unknown; type: string }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (value instanceof Date) return <>{value.toISOString()}</>;
  if (typeof value === "string" && UUID.test(value)) {
    return <span title={value}>{value.slice(0, 8)}…</span>;
  }
  if (typeof value === "object") return <>{JSON.stringify(value)}</>;
  if (value === "denied") {
    return <span className="bg-warn/15 text-warn rounded px-1.5">denied</span>;
  }
  return <span data-type={type}>{String(value)}</span>;
}

export function DataGrid({
  columns,
  rows,
}: {
  columns: Array<{ name: string; type: string }>;
  rows: Row[];
}) {
  return (
    <div className="bg-card min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.name}
                className="text-muted-foreground bg-muted sticky top-0 px-3 py-1.5 text-left text-[11px] font-medium whitespace-nowrap"
              >
                {column.name}
                <span className="block text-[10px] font-normal opacity-70">
                  {column.type}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-muted border-t">
              {columns.map((column) => (
                <td
                  key={column.name}
                  className="max-w-80 truncate px-3 py-1.5 whitespace-nowrap"
                >
                  <Cell value={row[column.name]} type={column.type} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
