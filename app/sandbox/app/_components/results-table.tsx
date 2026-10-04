import { GradeChip, formatDate } from "@/app/sandbox/_components/ui";
import type { Submission } from "@/app/sandbox/_lib/types";
import { cn } from "@/lib/utils";

const Null = () => <span className="text-muted-foreground italic">null</span>;

export function ResultsTable({
  rows,
  has_more,
  showStudent,
  selectedId,
  pendingIds,
  onSelect,
  onMore,
}: {
  rows: Submission[];
  has_more: boolean;
  showStudent: boolean;
  selectedId?: string | null;
  pendingIds?: Set<string>;
  onSelect?: (id: string) => void;
  onMore: () => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground p-6">
        No submissions match these filters.
      </div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-muted-foreground bg-muted text-left text-[11px]">
              {showStudent && (
                <th className="px-3 py-1.5 font-medium">Student</th>
              )}
              <th className="px-3 py-1.5 font-medium">Assignment</th>
              <th className="px-3 py-1.5 font-medium">Submitted</th>
              <th className="px-3 py-1.5 font-medium">Graded</th>
              <th className="px-3 py-1.5 font-medium">Grade</th>
              <th className="px-3 py-1.5 font-medium">Teacher notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onSelect ? () => onSelect(row.id) : undefined}
                className={cn(
                  "hover:bg-muted border-t align-top",
                  onSelect && "cursor-pointer",
                  row.id === selectedId && "bg-accent",
                  pendingIds?.has(row.id) && "opacity-60",
                )}
              >
                {showStudent && (
                  <td className="px-3 py-1.5">
                    {row.student.name}
                    <div className="text-muted-foreground">
                      {row.student.username}
                    </div>
                  </td>
                )}
                <td className="px-3 py-1.5">{row.assignment.title}</td>
                <td className="px-3 py-1.5 tabular-nums">
                  {formatDate(row.submitted_at)}
                </td>
                <td className="px-3 py-1.5 tabular-nums">
                  {formatDate(row.graded_at) ?? <Null />}
                </td>
                <td className="px-3 py-1.5">
                  <GradeChip grade={row.grade} />
                  {row.grade?.points_awarded ? (
                    <span className="text-muted-foreground ml-1.5 tabular-nums">
                      {row.grade.points_awarded}/{row.grade.max_points}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">{row.teacher_notes ?? <Null />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted-foreground flex items-center gap-3 border-t px-3.5 py-2">
        {rows.length} shown · has_more: {String(has_more)}
        {has_more && (
          <button
            type="button"
            className="border-input rounded border px-2 text-[11.5px]"
            onClick={onMore}
          >
            Load more
          </button>
        )}
      </div>
    </>
  );
}
