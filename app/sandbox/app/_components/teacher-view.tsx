"use client";

import { useOptimistic, useState, useTransition } from "react";

import {
  Banner,
  GradeChip,
  Panel,
  inputClass,
} from "@/app/sandbox/_components/ui";
import { BASE, send } from "@/app/sandbox/_lib/api";
import {
  isErrorBody,
  type ErrorDetail,
  type Submission,
} from "@/app/sandbox/_lib/types";
import { ErrorBanner } from "@/app/sandbox/app/_components/error-banner";
import { ResultsTable } from "@/app/sandbox/app/_components/results-table";
import { useSubmissionList } from "@/app/sandbox/app/_components/use-submission-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SandboxOptions } from "@/app/sandbox/_server/queries/read-options";

const FILTER_FIELDS = [
  ["assignment", "Assignment", "contains…"],
  ["student", "Student", "name or username"],
] as const;

interface GradeForm {
  points: string;
  band: string;
  notes: string;
  reason: string;
}

const emptyForm = (mode: string): GradeForm => ({
  points: "",
  band: mode === "band" ? "Pass" : "",
  notes: "",
  reason: "",
});

function Field({
  label,
  errors,
  children,
}: {
  label: string;
  errors: ErrorDetail[];
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 grid gap-0.5" data-invalid={errors.length > 0}>
      <span className="text-muted-foreground text-[11px]">{label}</span>
      {children}
      {errors.map((error) => (
        <span key={error.code} className="text-destructive text-[11.5px]">
          {error.code}: {error.message}
        </span>
      ))}
    </div>
  );
}

export function TeacherView({ options }: { options: SandboxOptions }) {
  const [filters, setFilters] = useState({
    assignment: "",
    student: "",
    from: "",
    to: "",
    grade: "",
    limit: "10",
  });
  const list = useSubmissionList(`${BASE}/submissions`, filters);
  const [optimisticRows, setOptimisticGrade] = useOptimistic(
    list.rows,
    (current, change: { id: string; label: string }) =>
      current.map((row) =>
        row.id === change.id
          ? {
              ...row,
              grade: {
                label: change.label,
                group: null,
                points_awarded: null,
                max_points: null,
                percent: null,
                scale_id: "",
              },
            }
          : row,
      ),
  );
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Submission | null>(null);
  const [form, setForm] = useState<GradeForm>(emptyForm("points"));
  const [failure, setFailure] = useState<{
    status: number;
    body: unknown;
  } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const assignment = selected
    ? options.assignments.find((a) => a.id === selected.assignment.id)
    : undefined;
  const mode = assignment?.grading_mode ?? "points";
  const regrade = Boolean(
    selected?.grade && selected.grade.label !== "Incomplete",
  );
  const details: ErrorDetail[] =
    failure && isErrorBody(failure.body)
      ? (failure.body.error.details ?? [])
      : [];
  const errorsFor = (field: string) => details.filter((d) => d.field === field);

  async function open(id: string) {
    const exchange = await send({
      method: "GET",
      path: `${BASE}/submissions/${id}`,
    });
    if (exchange.status !== 200) return;
    const submission = exchange.json as Submission;
    const target = options.assignments.find(
      (a) => a.id === submission.assignment.id,
    );
    setSelected(submission);
    setForm(emptyForm(target?.grading_mode ?? "points"));
    setFailure(null);
    setSaved(null);
  }

  function saveGrade() {
    if (!selected) return;
    const body: Record<string, string> = {};
    if (mode === "points" && form.points !== "") body.points = form.points;
    if (form.band) body.band = form.band;
    if (form.notes) body.teacher_notes = form.notes;
    if (form.reason) body.reason = form.reason;
    startTransition(async () => {
      setOptimisticGrade({
        id: selected.id,
        label: body.band ?? `${body.points ?? "…"} pts`,
      });
      const exchange = await send({
        method: "PUT",
        path: `${BASE}/submissions/${selected.id}/grade`,
        body,
      });
      if (exchange.status !== 200) {
        setFailure({ status: exchange.status, body: exchange.json });
        setSaved(null);
        return;
      }
      const updated = exchange.json as Submission;
      setFailure(null);
      setSelected(updated);
      setSaved(
        `Now ${updated.grade?.label ?? "ungraded"}. The grade event is in Data.`,
      );
      setForm((current) => ({ ...current, points: "", reason: "" }));
      list.setState((current) => ({
        ...current,
        rows: current.rows.map((row) =>
          row.id === updated.id ? updated : row,
        ),
      }));
    });
  }

  return (
    <div className="grid content-start gap-3.5 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
      <Panel
        title="Submissions overview"
        aside={<span className="text-muted-foreground">GET /submissions</span>}
        className="min-w-0"
      >
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 px-3.5 py-3">
          {FILTER_FIELDS.map(([name, label, placeholder]) => (
            <label
              key={name}
              className="text-muted-foreground grid gap-0.5 text-[11px]"
            >
              {label}
              <input
                id={`overview-${name}`}
                className={cn(inputClass, "text-foreground w-36")}
                placeholder={placeholder}
                value={filters[name]}
                onChange={(event) =>
                  setFilters({ ...filters, [name]: event.target.value })
                }
              />
            </label>
          ))}
          {(["from", "to"] as const).map((name) => (
            <label
              key={name}
              className="text-muted-foreground grid gap-0.5 text-[11px]"
            >
              {name === "from" ? "From" : "To"}
              <input
                id={`overview-${name}`}
                type="date"
                className={cn(inputClass, "text-foreground w-36")}
                value={filters[name]}
                onChange={(event) =>
                  setFilters({ ...filters, [name]: event.target.value })
                }
              />
            </label>
          ))}
          <label className="text-muted-foreground grid gap-0.5 text-[11px]">
            Grade
            <select
              id="overview-grade"
              className={cn(inputClass, "text-foreground w-28")}
              value={filters.grade}
              onChange={(event) =>
                setFilters({ ...filters, grade: event.target.value })
              }
            >
              <option value="">any</option>
              {[
                "A",
                "B",
                "C",
                "D",
                "F",
                "incomplete",
                "pass",
                "fail",
                "ungraded",
              ].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="text-muted-foreground grid gap-0.5 text-[11px]">
            Page size
            <select
              id="overview-limit"
              className={cn(inputClass, "text-foreground w-20")}
              value={filters.limit}
              onChange={(event) =>
                setFilters({ ...filters, limit: event.target.value })
              }
            >
              {["5", "10", "25"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        {list.error ? (
          <div className="px-3.5 pb-3">
            <ErrorBanner status={list.error.status} body={list.error.body} />
          </div>
        ) : (
          <ResultsTable
            rows={optimisticRows}
            has_more={list.has_more}
            showStudent
            selectedId={selected?.id}
            pendingIds={
              pending && selected ? new Set([selected.id]) : undefined
            }
            onSelect={(id) => void open(id)}
            onMore={() => void list.load(true)}
          />
        )}
      </Panel>
      <Panel
        title={selected ? selected.student.name : "Grade"}
        aside={<span className="text-muted-foreground">PUT …/grade</span>}
      >
        {!selected ? (
          <div className="text-muted-foreground p-6">
            Select a submission to read it and grade it. Opening one is a logged
            read.
          </div>
        ) : (
          <div className="px-3.5 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <b>{selected.assignment.title}</b>
              <GradeChip grade={selected.grade} />
              {selected.grade?.percent ? (
                <span className="text-muted-foreground tabular-nums">
                  {selected.grade.points_awarded}/{selected.grade.max_points} (
                  {selected.grade.percent}%)
                </span>
              ) : null}
            </div>
            <p className="bg-muted mb-3 rounded-md px-2.5 py-2 whitespace-pre-wrap">
              {selected.text}
            </p>
            {saved && <Banner tone="good">Saved. {saved}</Banner>}
            {failure && (
              <ErrorBanner status={failure.status} body={failure.body} />
            )}
            {mode === "points" ? (
              <>
                <Field
                  label={`points (0 to ${Number(assignment?.max_points ?? 0)})`}
                  errors={errorsFor("points")}
                >
                  <input
                    id="grade-points"
                    inputMode="decimal"
                    placeholder="e.g. 42"
                    className={cn(inputClass, "w-full")}
                    value={form.points}
                    onChange={(event) =>
                      setForm({ ...form, points: event.target.value })
                    }
                  />
                </Field>
                <Field label="or manual band" errors={errorsFor("band")}>
                  <select
                    id="grade-band"
                    className={cn(inputClass, "w-full")}
                    value={form.band}
                    onChange={(event) =>
                      setForm({ ...form, band: event.target.value })
                    }
                  >
                    <option value="">none</option>
                    <option>Incomplete</option>
                  </select>
                </Field>
              </>
            ) : (
              <Field label="band" errors={errorsFor("band")}>
                <select
                  id="grade-band"
                  className={cn(inputClass, "w-full")}
                  value={form.band}
                  onChange={(event) =>
                    setForm({ ...form, band: event.target.value })
                  }
                >
                  <option>Pass</option>
                  <option>Fail</option>
                </select>
              </Field>
            )}
            <Field label="teacher_notes" errors={errorsFor("teacher_notes")}>
              <textarea
                id="grade-notes"
                className={cn(inputClass, "min-h-16 w-full")}
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </Field>
            <Field
              label={`reason ${regrade ? "(required: this is a regrade)" : "(only needed on a regrade)"}`}
              errors={errorsFor("reason")}
            >
              <input
                id="grade-reason"
                className={cn(inputClass, "w-full")}
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </Field>
            <Button disabled={pending} onClick={saveGrade}>
              {regrade ? "Regrade" : "Save grade"}
            </Button>
            <p className="text-muted-foreground mt-3">
              Grade history is the append-only table{" "}
              <code>submission_grade_event</code> on the Data tab.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
