import { issue, type ValidationIssue } from "./validation";

function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** The instant a calendar day (`YYYY-MM-DD`) begins on the wall clock of `timeZone`. */
export function startOfLocalDay(date: string, timeZone: string): Date {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day);
  const approximate = wall - offsetMs(wall, timeZone);
  return new Date(wall - offsetMs(approximate, timeZone));
}

/** The calendar day after `date`, as `YYYY-MM-DD`. */
export function nextDay(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

export interface DayRange {
  from?: string;
  to?: string;
}

export function validateDayRange(range: DayRange): ValidationIssue[] {
  if (
    range.from !== undefined &&
    range.to !== undefined &&
    range.from > range.to
  ) {
    return [
      issue("to", "date_range_inverted", "`to` must not be before `from`"),
    ];
  }
  return [];
}

/** Both ends inclusive: `from` starts at its local midnight, `to` ends where the next local day begins. */
export function instantsForDayRange(
  range: DayRange,
  timeZone: string,
): { from: Date | null; before: Date | null } {
  return {
    from:
      range.from === undefined ? null : startOfLocalDay(range.from, timeZone),
    before:
      range.to === undefined
        ? null
        : startOfLocalDay(nextDay(range.to), timeZone),
  };
}
