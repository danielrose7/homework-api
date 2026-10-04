"use client";

import { useState } from "react";

import { toCurl } from "@/app/sandbox/_lib/api";
import type { Exchange } from "@/app/sandbox/_lib/exchange-store";
import { cn } from "@/lib/utils";

import { JsonView } from "@/app/sandbox/_components/json-view";
import { MethodTag, StatusChip } from "@/app/sandbox/_components/ui";

const TABS = [
  ["body", "Response"],
  ["headers", "Headers"],
  ["request", "Request"],
  ["curl", "cURL"],
] as const;

type Tab = (typeof TABS)[number][0];

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  return (
    <table>
      <tbody>
        {Object.entries(headers).map(([name, value]) => (
          <tr key={name}>
            <td className="text-muted-foreground pr-4 align-top whitespace-nowrap">
              {name}
            </td>
            <td className="break-all">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ExchangeView({ exchange }: { exchange: Exchange | null }) {
  const [tab, setTab] = useState<Tab>("body");
  const [copied, setCopied] = useState(false);
  if (!exchange) {
    return (
      <div className="text-muted-foreground p-6">
        No request sent yet. Pick one from the collection and press Send.
      </div>
    );
  }
  const curl = toCurl(exchange, window.location.origin);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <MethodTag method={exchange.method} />
        <span className="break-all">{exchange.path}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <StatusChip status={exchange.status} />
        <span className="text-muted-foreground">{exchange.ms} ms</span>
        <span className="text-muted-foreground">as {exchange.persona}</span>
        <span
          className="ml-auto flex gap-3.5"
          role="tablist"
          aria-label="Response view"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "border-b-2 border-transparent py-0.5",
                tab === id
                  ? "border-primary text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="border-input rounded border px-2 text-[11.5px]"
            onClick={() => {
              navigator.clipboard
                .writeText(curl)
                .then(() => setCopied(true))
                .catch(() => setTab("curl"));
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? "Copied" : "Copy cURL"}
          </button>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-2.5">
        {tab === "body" && <JsonView text={exchange.responseText} />}
        {tab === "headers" && (
          <HeaderTable headers={exchange.responseHeaders} />
        )}
        {tab === "request" && (
          <>
            <HeaderTable headers={exchange.requestHeaders} />
            {exchange.requestBody ? (
              <div className="mt-3">
                <JsonView text={prettyRequest(exchange.requestBody)} />
              </div>
            ) : null}
          </>
        )}
        {tab === "curl" && (
          <pre className="break-words whitespace-pre-wrap">{curl}</pre>
        )}
      </div>
    </div>
  );
}

function prettyRequest(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
