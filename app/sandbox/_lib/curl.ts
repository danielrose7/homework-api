import type { Exchange } from "@/app/sandbox/_lib/exchange-store";

/** Single-quote for a POSIX shell: close the quote, add an escaped quote, reopen. */
const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export function toCurl(exchange: Exchange, origin: string): string {
  const parts = [`curl -X ${exchange.method} ${quote(origin + exchange.path)}`];
  for (const [name, value] of Object.entries(exchange.requestHeaders)) {
    parts.push(`-H ${quote(`${name}: ${value}`)}`);
  }
  // --data-raw sends the body byte for byte; -d would treat a leading @ as a file name.
  if (exchange.requestBody !== null) {
    parts.push(`--data-raw ${quote(exchange.requestBody)}`);
  }
  return parts.join(" \\\n  ");
}
