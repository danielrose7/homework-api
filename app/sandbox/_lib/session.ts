import { useSyncExternalStore } from "react";

const KEY = "hw.session";

interface SessionState {
  active: string | null;
  tokens: Record<string, string>;
}

const EMPTY: SessionState = { active: null, tokens: {} };
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: SessionState = EMPTY;

function read(): SessionState {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = raw ? (JSON.parse(raw) as SessionState) : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(next: SessionState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    cachedRaw = null;
    cached = next;
  }
  listeners.forEach((listener) => listener());
}

export const session = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: read,
  tokenFor: (username: string) => read().tokens[username] ?? null,
  setToken(username: string, token: string) {
    const current = read();
    write({ ...current, tokens: { ...current.tokens, [username]: token } });
  },
  setActive(username: string | null) {
    write({ ...read(), active: username });
  },
  clearTokens() {
    write({ ...read(), tokens: {} });
  },
};

export function useSession() {
  return useSyncExternalStore(session.subscribe, session.get, () => EMPTY);
}
