"use client";

import { useState } from "react";

import { useRequestReset } from "@/app/sandbox/_components/workbench";
import { exchangeStore } from "@/app/sandbox/_lib/exchange-store";
import {
  CHECKS,
  caller,
  type Asserter,
  type Check,
} from "@/app/sandbox/checks/_components/checks";
import { Button } from "@/app/_components/button";
import { cn } from "@/lib/utils";

interface Line {
  ok: boolean;
  message: string;
  exchangeId: number | null;
}

interface Result {
  running: boolean;
  pass: boolean;
  lines: Line[];
}

async function execute(check: Check): Promise<Result> {
  const lines: Line[] = [];
  const t: Asserter = {
    ok: (exchange, condition, message) =>
      lines.push({ ok: condition, message, exchangeId: exchange?.id ?? null }),
    eq: (exchange, actual, expected, message) =>
      lines.push({
        ok: actual === expected,
        message:
          actual === expected ? message : `${message} (got ${String(actual)})`,
        exchangeId: exchange?.id ?? null,
      }),
  };
  try {
    await check.run(t, caller);
  } catch (error) {
    lines.push({
      ok: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      exchangeId: null,
    });
  }
  return { running: false, pass: lines.every((line) => line.ok), lines };
}

function Mark({ result }: { result: Result | undefined }) {
  return (
    <span
      className={cn(
        "mt-0.5 grid size-[18px] place-items-center rounded-full border text-[11px]",
        !result && "text-muted-foreground",
        result?.running && "border-primary text-primary",
        result &&
          !result.running &&
          result.pass &&
          "bg-good border-good text-background",
        result &&
          !result.running &&
          !result.pass &&
          "bg-destructive border-destructive text-background",
      )}
    >
      {!result ? "" : result.running ? "…" : result.pass ? "✓" : "✕"}
    </span>
  );
}

export function ChecksView() {
  const requestReset = useRequestReset();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState(false);

  async function runOne(check: Check) {
    setResults((current) => ({
      ...current,
      [check.id]: { running: true, pass: false, lines: [] },
    }));
    const result = await execute(check);
    setResults((current) => ({ ...current, [check.id]: result }));
  }

  async function runAll() {
    const confirmed = await requestReset(
      "Run all starts from a freshly seeded school so every check has the data it expects.",
    );
    if (!confirmed) return;
    setBusy(true);
    setResults({});
    for (const check of CHECKS) await runOne(check);
    setBusy(false);
  }

  const passing = Object.values(results).filter(
    (r) => !r.running && r.pass,
  ).length;
  return (
    <div className="mx-auto grid w-full max-w-4xl content-start gap-3 overflow-auto p-4">
      <header className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground min-w-60 flex-1">
          Each check signs in as a persona and drives the API the way a client
          would. Rows land in the network log, and every assertion links to the
          call that proved it.
        </p>
        <Button disabled={busy} onClick={() => void runAll()}>
          {busy ? "Running…" : "Reset and run all"}
        </Button>
        <span>
          {passing}/{CHECKS.length} passing
        </span>
      </header>
      <section className="bg-card rounded-lg border">
        {CHECKS.map((check, index) => {
          const result = results[check.id];
          const heading =
            check.section !== CHECKS[index - 1]?.section
              ? check.section === "brief"
                ? "From the brief"
                : "Guardrails the plan promises"
              : null;
          return (
            <div key={check.id}>
              {heading && (
                <div className="text-muted-foreground px-3.5 pt-3 text-[11px] tracking-widest uppercase">
                  {heading}
                </div>
              )}
              <div className="grid grid-cols-[1.6rem_minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 border-t px-3.5 py-2.5 first:border-t-0">
                <Mark result={result} />
                <div>
                  <b>{check.title}</b>
                  <div className="text-muted-foreground text-[11.5px]">
                    {check.requirement}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void runOne(check)}
                >
                  Run
                </Button>
                {result && !result.running && (
                  <ul className="col-start-2 mt-1 grid gap-0.5">
                    {result.lines.map((line, index) => (
                      <li
                        key={index}
                        className={line.ok ? "text-good" : "text-destructive"}
                      >
                        {line.ok ? "✓" : "✕"} {line.message}
                        {line.exchangeId !== null && (
                          <button
                            type="button"
                            className="text-muted-foreground pl-1.5 underline decoration-dotted"
                            onClick={() =>
                              exchangeStore.select(line.exchangeId)
                            }
                          >
                            #{line.exchangeId}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
