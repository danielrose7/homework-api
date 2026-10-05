"use client";

import { useOptimistic, useState, useTransition } from "react";

import { Panel, Banner, inputClass } from "@/app/sandbox/_components/ui";
import { BASE, send } from "@/app/sandbox/_lib/api";
import { useSession } from "@/app/sandbox/_lib/session";
import type { Submission } from "@/app/sandbox/_lib/types";
import { ErrorBanner } from "@/app/sandbox/app/_components/error-banner";
import { ResultsTable } from "@/app/sandbox/app/_components/results-table";
import { useSubmissionList } from "@/app/sandbox/app/_components/use-submission-list";
import { Button } from "@/app/_components/button";
import type { SandboxOptions } from "@/app/sandbox/_server/queries/read-options";

type Outcome = { status: number; body: unknown; location?: string };

export function StudentView({ options }: { options: SandboxOptions }) {
  const { active } = useSession();
  const [filters, setFilters] = useState({ grade: "", assignment: "" });
  const list = useSubmissionList(`${BASE}/submissions/me`, {
    ...filters,
    limit: "10",
  });
  const [optimisticRows, addOptimistic] = useOptimistic(
    list.rows,
    (current, draft: Submission) => [draft, ...current],
  );
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  const submitted = new Set(
    options.submissions
      .filter((row) => row.student === active)
      .map((row) => row.assignment_id),
  );
  for (const [assignment_id, outcome] of Object.entries(outcomes)) {
    if (outcome.status === 201) submitted.add(assignment_id);
  }
  const assignments = options.assignments.toSorted(
    (a, b) => Number(submitted.has(a.id)) - Number(submitted.has(b.id)),
  );

  function submit(assignment: SandboxOptions["assignments"][number]) {
    const text = answers[assignment.id] ?? "";
    startTransition(async () => {
      addOptimistic({
        id: `optimistic-${assignment.id}`,
        object: "submission",
        assignment: { id: assignment.id, title: assignment.title },
        student: { member_id: "", name: active ?? "", username: active ?? "" },
        attempt_number: 1,
        text,
        submitted_at: new Date().toISOString(),
        graded_at: null,
        teacher_notes: null,
        grade: null,
      });
      const exchange = await send({
        method: "POST",
        path: `${BASE}/assignments/${assignment.id}/submissions`,
        body: { text },
      });
      setOutcomes((current) => ({
        ...current,
        [assignment.id]: {
          status: exchange.status,
          body: exchange.json,
          location: exchange.responseHeaders.location,
        },
      }));
      if (exchange.status === 201) {
        setAnswers((current) => ({ ...current, [assignment.id]: "" }));
      }
      await list.load(false);
    });
  }

  return (
    <div className="grid content-start gap-3.5 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
      <Panel
        title="My submissions"
        aside={
          <span className="text-muted-foreground">GET /submissions/me</span>
        }
      >
        <div className="flex flex-wrap items-end gap-3 px-3.5 py-3">
          <label className="text-muted-foreground grid gap-0.5 text-[11px]">
            Grade
            <select
              id="mine-grade"
              className={`${inputClass} w-36 text-foreground`}
              value={filters.grade}
              onChange={(event) =>
                setFilters({ ...filters, grade: event.target.value })
              }
            >
              <option value="">any</option>
              {["A", "B", "C", "D", "F", "incomplete", "ungraded"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="text-muted-foreground grid gap-0.5 text-[11px]">
            Assignment name
            <input
              id="mine-assignment"
              className={`${inputClass} w-44 text-foreground`}
              placeholder="contains…"
              value={filters.assignment}
              onChange={(event) =>
                setFilters({ ...filters, assignment: event.target.value })
              }
            />
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
            showStudent={false}
            pendingIds={
              pending
                ? new Set(
                    optimisticRows
                      .filter((row) => row.id.startsWith("optimistic-"))
                      .map((row) => row.id),
                  )
                : undefined
            }
            onMore={() => void list.load(true)}
          />
        )}
      </Panel>
      <Panel
        title="Assignments"
        aside={
          <span className="text-muted-foreground">
            POST /assignments/&#123;id&#125;/submissions
          </span>
        }
      >
        {assignments.map((assignment) => {
          const outcome = outcomes[assignment.id];
          return (
            <div
              key={assignment.id}
              className="grid gap-2 border-b px-3.5 py-3 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline gap-2.5">
                <b>{assignment.title}</b>
                <span className="text-muted-foreground">
                  {assignment.class_name} ·{" "}
                  {assignment.grading_mode === "band"
                    ? "Pass / Fail"
                    : `${Number(assignment.max_points)} pts`}
                </span>
                {submitted.has(assignment.id) && (
                  <span className="bg-info/15 text-info rounded px-1.5 text-[11.5px]">
                    submitted
                  </span>
                )}
              </div>
              {outcome &&
                (outcome.status === 201 ? (
                  <Banner tone="good">
                    201 Created. Location:{" "}
                    {outcome.location?.replace(window.location.origin, "")}
                  </Banner>
                ) : (
                  <ErrorBanner status={outcome.status} body={outcome.body} />
                ))}
              <textarea
                aria-label={`Answer for ${assignment.title}`}
                placeholder="Write your answer…"
                className={`${inputClass} min-h-16 w-full`}
                value={answers[assignment.id] ?? ""}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    [assignment.id]: event.target.value,
                  })
                }
              />
              <div>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => submit(assignment)}
                >
                  Submit
                </Button>{" "}
                {submitted.has(assignment.id) && (
                  <span className="text-muted-foreground">
                    Already submitted, expect 409.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
