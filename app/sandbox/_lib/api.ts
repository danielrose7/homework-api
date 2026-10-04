import {
  exchangeStore,
  type Exchange,
} from "@/app/sandbox/_lib/exchange-store";
import { session } from "@/app/sandbox/_lib/session";
import { DEMO_PASSWORD } from "@/modules/demo/seed-data";

export const ORG = "sandbox";
export const BASE = `/api/v1/orgs/${ORG}`;

export type AuthMode = "persona" | "none" | "bad";

export interface SendOptions {
  method: string;
  path: string;
  /** A string is sent as written, so the console can send malformed JSON. */
  body?: string | object;
  auth?: AuthMode;
  /** Send as this persona instead of the active one, signing in first when needed. */
  as?: string;
  /** Name to show in the network log instead of the persona that sent it. */
  label?: string;
  /** Keep dev plumbing (picker data, table reads) out of the network log. */
  record?: boolean;
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export async function send(options: SendOptions): Promise<Exchange> {
  const auth = options.auth ?? "persona";
  const username = options.as ?? session.get().active ?? "";
  const headers: Record<string, string> = { accept: "application/json" };

  if (auth === "persona") {
    const token = session.tokenFor(username) ?? (await signIn(username));
    if (token) headers.authorization = `Bearer ${token}`;
  }
  if (auth === "bad") headers.authorization = "Bearer not-a-real-token";

  let requestBody: string | null = null;
  if (options.body !== undefined) {
    requestBody =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
    headers["content-type"] = "application/json";
  }

  const startedAt = performance.now();
  const response = await fetch(options.path, {
    method: options.method,
    headers,
    body: requestBody,
  });
  const text = await response.text();
  const ms = Math.round(performance.now() - startedAt);

  let json: unknown = null;
  let responseText = text;
  try {
    json = JSON.parse(text);
    responseText = JSON.stringify(json, null, 2);
  } catch {
    // Not JSON (an HTML error page, an empty body): show it as received.
  }

  const exchange: Exchange = {
    id: exchangeStore.nextId(),
    at: Date.now(),
    method: options.method,
    path: options.path,
    persona:
      options.label ??
      (auth === "none" ? "anon" : auth === "bad" ? "bad token" : username),
    requestHeaders: headers,
    requestBody,
    status: response.status,
    statusText: response.statusText,
    responseHeaders: headersToObject(response.headers),
    responseText,
    json,
    ms,
  };
  if (options.record !== false) exchangeStore.push(exchange);
  return exchange;
}

/** Signs in through the public auth endpoint and keeps the bearer token for the tab's lifetime. */
export async function signIn(username: string): Promise<string | null> {
  const exchange = await send({
    method: "POST",
    path: "/api/auth/sign-in/username",
    body: { username, password: DEMO_PASSWORD },
    auth: "none",
    label: username,
  });
  const token = exchange.responseHeaders["set-auth-token"] ?? null;
  if (exchange.status === 200 && token) session.setToken(username, token);
  return token;
}

export async function devJson<T>(path: string): Promise<T | null> {
  const exchange = await send({
    method: "GET",
    path,
    auth: "none",
    record: false,
  });
  return exchange.status === 200 ? (exchange.json as T) : null;
}

export function toCurl(exchange: Exchange, origin: string): string {
  const parts = [`curl -X ${exchange.method} '${origin}${exchange.path}'`];
  for (const [name, value] of Object.entries(exchange.requestHeaders)) {
    if (name === "accept") continue;
    parts.push(`-H '${name}: ${value}'`);
  }
  if (exchange.requestBody) {
    parts.push(`-d '${exchange.requestBody.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(" \\\n  ");
}

/** Makes `username` the active persona, signing in first unless a token is already held. */
export async function switchPersona(username: string, fresh = false) {
  if (fresh || !session.tokenFor(username)) await signIn(username);
  session.setActive(username);
}
