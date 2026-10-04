import { useSyncExternalStore } from "react";

export interface Exchange {
  id: number;
  at: number;
  method: string;
  path: string;
  persona: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseText: string;
  /** Parsed body when the response is JSON. */
  json: unknown;
  ms: number;
}

interface StoreState {
  exchanges: readonly Exchange[];
  selectedId: number | null;
}

const listeners = new Set<() => void>();
const EMPTY: StoreState = { exchanges: [], selectedId: null };
let state: StoreState = EMPTY;
let nextId = 1;

function set(next: StoreState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export const exchangeStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  getServerSnapshot: () => EMPTY,
  nextId: () => nextId++,
  push(exchange: Exchange) {
    set({
      exchanges: [...state.exchanges, exchange],
      selectedId: exchange.id,
    });
  },
  select(id: number | null) {
    set({ ...state, selectedId: id });
  },
  clear() {
    set({ exchanges: [], selectedId: null });
  },
};

export function useExchanges() {
  return useSyncExternalStore(
    exchangeStore.subscribe,
    exchangeStore.getSnapshot,
    exchangeStore.getServerSnapshot,
  );
}
