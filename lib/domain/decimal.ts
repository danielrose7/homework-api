const PATTERN = /^-?\d+(\.\d{1,2})?$/;

/** Exact hundredths (e.g. 42.5 becomes 4250). Values with more than two decimals are rejected, never rounded. */
export function toHundredths(value: string | number): number | null {
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!PATTERN.test(text)) return null;
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const hundredths = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -hundredths : hundredths;
}

export function formatHundredths(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}
