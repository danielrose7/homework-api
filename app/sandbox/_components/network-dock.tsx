"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BASE } from "@/app/sandbox/_lib/api";
import { exchangeStore, useExchanges } from "@/app/sandbox/_lib/exchange-store";
import { cn } from "@/lib/utils";

import { MethodTag, StatusChip } from "@/app/sandbox/_components/ui";

const clock = (at: number) => new Date(at).toLocaleTimeString("en-GB");

export function NetworkDock({
  onInspect,
}: {
  onInspect: (id: number) => void;
}) {
  const { exchanges, selectedId } = useExchanges();
  const [open, setOpen] = useState(true);
  const rows = [...exchanges].reverse();
  return (
    <section className="bg-card flex-none border-t">
      <div className="bg-muted flex items-center gap-3 px-4 py-1">
        <b>Network</b>
        <span className="text-muted-foreground">
          {exchanges.length} request{exchanges.length === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground hidden sm:inline">
          click a row to inspect
        </span>
        <span className="ml-auto flex gap-1.5">
          <Button
            size="xs"
            variant="outline"
            onClick={() => exchangeStore.clear()}
          >
            Clear
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide" : "Show"}
          </Button>
        </span>
      </div>
      {open && (
        <div className="h-40 overflow-auto md:h-48">
          {rows.length === 0 ? (
            <div className="text-muted-foreground p-6">
              Every call the UI makes lands here, the way the browser network
              tab shows it.
            </div>
          ) : (
            <table className="w-full">
              <thead className="text-muted-foreground bg-card sticky top-0 text-left text-[10.5px] tracking-wider uppercase">
                <tr>
                  <th className="px-3 py-1">#</th>
                  <th className="px-3 py-1">Time</th>
                  <th className="px-3 py-1">Method</th>
                  <th className="px-3 py-1">Path ({BASE})</th>
                  <th className="px-3 py-1">Status</th>
                  <th className="px-3 py-1">As</th>
                  <th className="px-3 py-1">Took</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      exchangeStore.select(row.id);
                      onInspect(row.id);
                    }}
                    className={cn(
                      "hover:bg-muted cursor-pointer",
                      row.id === selectedId && "bg-accent",
                    )}
                  >
                    <td className="text-muted-foreground px-3 py-0.5">
                      {row.id}
                    </td>
                    <td className="text-muted-foreground px-3 py-0.5">
                      {clock(row.at)}
                    </td>
                    <td className="px-3 py-0.5">
                      <MethodTag method={row.method} />
                    </td>
                    <td className="max-w-[16rem] truncate px-3 py-0.5 md:max-w-xl">
                      {row.path.replace(BASE, "")}
                    </td>
                    <td className="px-3 py-0.5">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="text-muted-foreground px-3 py-0.5">
                      {row.persona}
                    </td>
                    <td className="text-muted-foreground px-3 py-0.5">
                      {row.ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
