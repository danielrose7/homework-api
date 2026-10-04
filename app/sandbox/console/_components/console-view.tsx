"use client";

import { useState } from "react";

import { ExchangeView } from "@/app/sandbox/_components/exchange-view";
import { MethodTag, inputClass } from "@/app/sandbox/_components/ui";
import { send, switchPersona, type AuthMode } from "@/app/sandbox/_lib/api";
import { useExchanges } from "@/app/sandbox/_lib/exchange-store";
import { roleOf } from "@/app/sandbox/_lib/people";
import { session, useSession } from "@/app/sandbox/_lib/session";
import {
  presetsFor,
  subLabel,
  type CatalogGroup,
  type CatalogItem,
  type Preset,
} from "@/app/sandbox/console/_components/catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SandboxOptions } from "@/app/sandbox/_server/queries/read-options";

type SubTab = "params" | "body" | "auth";

interface QueryRow {
  k: string;
  v: string;
  on: boolean;
}

interface Draft {
  path: string;
  query: QueryRow[];
  body: string;
  auth: AuthMode;
  vars: Record<string, string>;
  sub: SubTab;
}

function makeDraft(item: CatalogItem, persona: string): Draft {
  const sample =
    item.key === "sign_in" && item.sample
      ? { ...item.sample, username: persona }
      : item.sample;
  return {
    path: item.path,
    query: (item.query ?? []).map((k) => ({ k, v: "", on: false })),
    body: sample ? JSON.stringify(sample, null, 2) : "",
    auth: item.auth ?? "persona",
    vars: {},
    sub: item.method === "GET" ? "params" : "body",
  };
}

const varsIn = (path: string) =>
  [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");

export function ConsoleView({
  catalog,
  options,
}: {
  catalog: CatalogGroup[];
  options: SandboxOptions;
}) {
  const allItems = catalog.flatMap((group) => group.items);
  const { active } = useSession();
  const persona = active ?? "";
  const { exchanges, selectedId } = useExchanges();
  const selected = exchanges.find((item) => item.id === selectedId) ?? null;
  const [key, setKey] = useState("sign_in");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sending, setSending] = useState(false);

  const item = allItems.find((candidate) => candidate.key === key);
  if (!item) return null;
  const draftKey = (k: string) => (k === "sign_in" ? `sign_in:${persona}` : k);
  const draft = drafts[draftKey(key)] ?? makeDraft(item, persona);
  const patch = (changes: Partial<Draft>, forKey = key) =>
    setDrafts((current) => {
      const target = allItems.find((candidate) => candidate.key === forKey);
      if (!target) return current;
      return {
        ...current,
        [forKey]: {
          ...(current[forKey] ?? makeDraft(target, persona)),
          ...changes,
        },
      };
    });

  const optionsFor = (name: string): Array<[string, string]> =>
    name === "assignment_id"
      ? options.assignments.map((a) => [a.id, `${a.title} (${a.class_name})`])
      : options.submissions.map((s) => [s.id, subLabel(s)]);

  const resolved = (name: string, source: Draft) =>
    source.vars[name] ?? optionsFor(name)[0]?.[0] ?? "";

  function urlFor(source: Draft) {
    const path = source.path.replace(
      /\{(\w+)\}/g,
      (_, name: string) => resolved(name, source) || `{${name}}`,
    );
    const query = source.query
      .filter((row) => row.on && row.k)
      .map((row) => `${encodeURIComponent(row.k)}=${encodeURIComponent(row.v)}`)
      .join("&");
    return query ? `${path}?${query}` : path;
  }

  async function sendDraft(source: Draft = draft, target: CatalogItem = item!) {
    setSending(true);
    try {
      await send({
        method: target.method,
        path: urlFor(source),
        body: target.method === "GET" ? undefined : source.body,
        auth: source.auth,
      });
    } finally {
      setSending(false);
    }
  }

  const group = presetsFor(key, options, active);
  const canNext = Boolean(
    selected &&
    selected.status === 200 &&
    (selected.json as { has_more?: boolean } | null)?.has_more &&
    selected.path.split("?")[0] === draft.path,
  );

  async function applyPreset(preset: Preset) {
    if (!group) return;
    const picked = preset.pick?.();
    let who = typeof preset.as === "function" ? preset.as(picked) : preset.as;
    const current = session.get().active;
    if (!who && (group.pin || !group.roles.includes(roleOf(current) ?? ""))) {
      who = group.as;
    }
    if (who && who !== current) await switchPersona(who);

    const next: Draft = {
      ...(drafts[key] ?? makeDraft(item!, who ?? persona)),
    };
    if (preset.next) {
      const lastId = (
        selected?.json as { data?: Array<{ id: string }> } | null
      )?.data?.at(-1)?.id;
      next.query = next.query.map((row) =>
        row.k === "starting_after"
          ? { ...row, v: lastId ?? "", on: true }
          : row,
      );
      next.sub = "params";
    } else if (preset.q) {
      const base = (item!.query ?? []).map((k): QueryRow => ({
        k,
        v: "",
        on: false,
      }));
      for (const [k, v] of Object.entries(preset.q)) {
        const row = base.find((candidate) => candidate.k === k);
        if (row) Object.assign(row, { v, on: true });
        else base.push({ k, v, on: true });
      }
      next.query = base;
      next.sub = "params";
    }
    if (preset.body) {
      next.body = JSON.stringify(preset.body(picked), null, 2);
      next.sub = "body";
    }
    if (picked) {
      next.vars = {
        ...next.vars,
        [key === "submit" ? "assignment_id" : "submission_id"]: picked.id,
      };
    }
    patch(next);
    await sendDraft(next);
  }

  const subTabs: Array<[SubTab, string]> = [
    ["params", "Params"],
    ...(item.method !== "GET"
      ? ([["body", "Body"]] as Array<[SubTab, string]>)
      : []),
    ["auth", "Auth"],
  ];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <nav
        aria-label="Request collection"
        className="bg-card max-h-48 overflow-auto border-b py-2 md:max-h-none md:border-r md:border-b-0"
      >
        {catalog.map((section) => (
          <div key={section.group}>
            <h4 className="text-muted-foreground mx-3.5 mt-2.5 mb-1 text-[10.5px] tracking-widest uppercase">
              {section.group}
            </h4>
            {section.items.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-current={key === entry.key}
                onClick={() => setKey(entry.key)}
                className="hover:bg-muted aria-[current=true]:bg-accent flex w-full items-baseline gap-2 px-3.5 py-1 text-left"
              >
                <span className="w-9 flex-none">
                  <MethodTag method={entry.method} />
                </span>
                {entry.name}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-col overflow-auto">
        <div className="flex flex-wrap items-stretch gap-2 px-4 pt-3 pb-2">
          <span className="bg-card flex items-center rounded-md border px-2.5 font-bold">
            <MethodTag method={item.method} />
          </span>
          <input
            id="console-url"
            aria-label="Request path"
            spellCheck={false}
            value={draft.path}
            onChange={(event) => patch({ path: event.target.value })}
            className={cn(inputClass, "min-w-48 flex-1 py-1.5")}
          />
          <Button disabled={sending} onClick={() => void sendDraft()}>
            Send
          </Button>
        </div>
        <p className="text-muted-foreground px-4 pb-2">{item.note}</p>
        {group ? (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
            <span className="text-muted-foreground mr-0.5 text-[11px] tracking-wider uppercase">
              Try
            </span>
            {group.items.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={preset.next && !canNext}
                onClick={() => void applyPreset(preset)}
                title={
                  preset.next
                    ? "Sets starting_after to the last id of the previous page"
                    : undefined
                }
                className={cn(
                  "hover:border-ring inline-flex items-baseline gap-1.5 rounded-full border px-2.5 text-[11.5px] disabled:opacity-40",
                  preset.err && "text-warn border-dashed",
                )}
              >
                {preset.label}
                {preset.err ? (
                  <i className="text-muted-foreground text-[10.5px] not-italic">
                    {preset.err}
                  </i>
                ) : null}
                {preset.note ? (
                  <i className="text-muted-foreground text-[10.5px] not-italic">
                    {preset.note}
                  </i>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        <div role="tablist" className="flex gap-3.5 border-b px-4">
          {subTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={draft.sub === id}
              onClick={() => patch({ sub: id })}
              className={cn(
                "border-b-2 border-transparent py-1.5",
                draft.sub === id
                  ? "border-primary text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid min-h-28 content-start gap-2 px-4 py-2.5">
          {draft.sub === "params" && (
            <>
              {varsIn(draft.path).length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5">
                  {varsIn(draft.path).map((name) => (
                    <label
                      key={name}
                      className="flex min-w-0 items-center gap-1.5"
                    >
                      {name}
                      <select
                        className={cn(inputClass, "max-w-full")}
                        value={resolved(name, draft)}
                        onChange={(event) =>
                          patch({
                            vars: { ...draft.vars, [name]: event.target.value },
                          })
                        }
                      >
                        {optionsFor(name).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              {draft.query.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1.4rem_minmax(5rem,10rem)_minmax(0,1fr)_1.5rem] items-center gap-1.5"
                >
                  <input
                    type="checkbox"
                    aria-label={`enable ${row.k}`}
                    checked={row.on}
                    onChange={(event) =>
                      updateRow(index, { on: event.target.checked })
                    }
                  />
                  <input
                    aria-label="param name"
                    className={cn(inputClass, "min-w-0")}
                    value={row.k}
                    onChange={(event) =>
                      updateRow(index, { k: event.target.value })
                    }
                  />
                  <input
                    aria-label={`value of ${row.k}`}
                    placeholder="value"
                    className={cn(inputClass, "min-w-0")}
                    value={row.v}
                    onChange={(event) =>
                      updateRow(index, { v: event.target.value, on: true })
                    }
                  />
                  <button
                    type="button"
                    aria-label="remove"
                    className="text-muted-foreground"
                    onClick={() =>
                      patch({
                        query: draft.query.filter((_, i) => i !== index),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    patch({
                      query: [...draft.query, { k: "", v: "", on: true }],
                    })
                  }
                >
                  + param
                </Button>{" "}
                <span className="text-muted-foreground">
                  Add any key; unknown ones return 422.
                </span>
              </div>
            </>
          )}
          {draft.sub === "body" && (
            <>
              <textarea
                id="console-body"
                aria-label="JSON body"
                spellCheck={false}
                value={draft.body}
                onChange={(event) => patch({ body: event.target.value })}
                className={cn(inputClass, "min-h-28 w-full resize-y")}
              />
              <span className="text-muted-foreground">
                JSON body, sent as written. Multipart uploads are supported by
                the API and not built into this console.
              </span>
            </>
          )}
          {draft.sub === "auth" && (
            <>
              <label className="flex items-center gap-2">
                Authorization
                <select
                  id="console-auth"
                  className={inputClass}
                  value={draft.auth}
                  onChange={(event) =>
                    patch({ auth: event.target.value as AuthMode })
                  }
                >
                  <option value="persona">Bearer token of {persona}</option>
                  <option value="none">No token</option>
                  <option value="bad">Invalid token</option>
                </select>
              </label>
              <span className="text-muted-foreground break-all">
                {draft.auth === "persona"
                  ? `Bearer ${session.tokenFor(persona) ?? "(not signed in)"}`
                  : draft.auth === "none"
                    ? "Sends no Authorization header. Expect 401."
                    : "Sends a made-up token. Expect 401."}
              </span>
            </>
          )}
        </div>
        <div className="bg-card flex min-h-56 flex-1 flex-col border-t">
          <ExchangeView key={selected?.id ?? 0} exchange={selected} />
        </div>
      </div>
    </div>
  );

  function updateRow(index: number, changes: Partial<QueryRow>) {
    patch({
      query: draft.query.map((row, i) =>
        i === index ? { ...row, ...changes } : row,
      ),
    });
  }
}
