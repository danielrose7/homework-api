"use client";

import { Check, Copy, Maximize2, Minimize2 } from "lucide-react";
import {
  ViewTransition,
  startTransition,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { JsonView } from "@/app/sandbox/_components/json-view";
import { StatusChip } from "@/app/sandbox/_components/ui";
import { toCurl } from "@/app/sandbox/_lib/curl";
import type { Exchange } from "@/app/sandbox/_lib/exchange-store";
import { cn } from "@/lib/utils";

const TABS = [
  ["request", "Request"],
  ["response", "Response"],
  ["curl", "cURL"],
] as const;

type Tab = (typeof TABS)[number][0];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h4 className="text-muted-foreground mb-1 text-[10.5px] tracking-widest uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <table>
      <tbody>
        {rows.map(([name, value]) => (
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

const headerRows = (headers: Record<string, string>) =>
  Object.entries(headers) as Array<[string, string]>;

function prettyRequest(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function RequestTab({ exchange }: { exchange: Exchange }) {
  const sent = new Date(exchange.at);
  return (
    <>
      <Section title="Request">
        <Rows
          rows={[
            [
              "Time",
              `${sent.toLocaleTimeString("en-GB")}.${String(sent.getMilliseconds()).padStart(3, "0")} · ${sent.toLocaleDateString("en-CA")}`,
            ],
            ["Method", exchange.method],
            ["URL", `${window.location.origin}${exchange.path}`],
            ["As", exchange.persona],
          ]}
        />
      </Section>
      <Section title="Headers">
        <Rows rows={headerRows(exchange.requestHeaders)} />
      </Section>
      {exchange.requestBody !== null && (
        <Section title="Body">
          <JsonView text={prettyRequest(exchange.requestBody)} />
        </Section>
      )}
    </>
  );
}

function ResponseTab({ exchange }: { exchange: Exchange }) {
  return (
    <>
      <Section title="Response">
        <Rows
          rows={[
            ["Status", <StatusChip key="s" status={exchange.status} />],
            ["Took", `${exchange.ms} ms`],
            ["Size", `${new Blob([exchange.responseText]).size} bytes`],
          ]}
        />
      </Section>
      <Section title="Headers">
        <Rows rows={headerRows(exchange.responseHeaders)} />
      </Section>
      <Section title="Body">
        <JsonView text={exchange.responseText} />
      </Section>
    </>
  );
}

export function ExchangeView({ exchange }: { exchange: Exchange | null }) {
  const [tab, setTab] = useState<Tab>("request");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () =>
    startTransition(() => setExpanded((value) => !value));
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleExpanded();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);
  if (!exchange) {
    return (
      <div className="text-muted-foreground p-6">
        No request sent yet. Pick one from the collection and press Send.
      </div>
    );
  }
  const curl = toCurl(exchange, window.location.origin);
  return (
    <ViewTransition name="exchange-panel" update="exchange-morph">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          expanded && "bg-card fixed inset-0 z-50",
        )}
      >
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
          <span
            role="tablist"
            aria-label="Exchange view"
            className="flex gap-3.5"
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
          </span>
          <button
            type="button"
            className="border-input inline-flex items-center gap-1 rounded border px-2 text-[11.5px]"
            onClick={() => {
              navigator.clipboard
                .writeText(curl)
                .then(() => setCopied(true))
                .catch(() => setTab("curl"));
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy cURL"}
          </button>
          <span className="ml-auto flex items-center gap-2">
            <StatusChip status={exchange.status} />
            <span className="text-muted-foreground">{exchange.ms} ms</span>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse" : "Expand to full screen"}
              title={expanded ? "Collapse (Esc)" : "Expand to full screen"}
              className="border-input text-muted-foreground hover:text-foreground rounded border p-1"
              onClick={toggleExpanded}
            >
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-2.5">
          {tab === "request" && <RequestTab exchange={exchange} />}
          {tab === "response" && <ResponseTab exchange={exchange} />}
          {tab === "curl" && (
            <pre className="break-words whitespace-pre-wrap">{curl}</pre>
          )}
        </div>
      </div>
    </ViewTransition>
  );
}
