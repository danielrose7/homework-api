"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { send } from "@/app/sandbox/_lib/api";
import {
  isErrorBody,
  type ListResponse,
  type Submission,
} from "@/app/sandbox/_lib/types";
import { useSession } from "@/app/sandbox/_lib/session";

export interface ListState {
  rows: Submission[];
  has_more: boolean;
  error: { status: number; body: unknown } | null;
}

const toQuery = (params: Record<string, string>) =>
  Object.entries(params)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

/** Loads a submissions list from the public API, refetching (debounced) as the filters change. */
export function useSubmissionList(
  path: string,
  filters: Record<string, string>,
) {
  const { active } = useSession();
  const [state, setState] = useState<ListState>({
    rows: [],
    has_more: false,
    error: null,
  });
  const latest = useRef(0);
  const filterKey = JSON.stringify(filters);

  const load = useCallback(
    async (more = false) => {
      const ticket = ++latest.current;
      const params = { ...(JSON.parse(filterKey) as Record<string, string>) };
      const lastRow = state.rows.at(-1);
      if (more && lastRow) params.starting_after = lastRow.id;
      const query = toQuery(params);
      const exchange = await send({
        method: "GET",
        path: query ? `${path}?${query}` : path,
      });
      if (ticket !== latest.current) return;
      if (exchange.status !== 200 || isErrorBody(exchange.json)) {
        setState((current) => ({
          ...current,
          rows: more ? current.rows : [],
          error: { status: exchange.status, body: exchange.json },
        }));
        return;
      }
      const page = exchange.json as ListResponse<Submission>;
      startTransition(() =>
        setState((current) => ({
          rows: more ? [...current.rows, ...page.data] : page.data,
          has_more: page.has_more,
          error: null,
        })),
      );
    },
    [path, filterKey, state.rows],
  );

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => void load(false), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, path, filterKey]);

  return { ...state, setState, load };
}
