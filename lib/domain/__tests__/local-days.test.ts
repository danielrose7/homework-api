import { describe, expect, it } from "vitest";

import {
  instantsForDayRange,
  isTimeZone,
  nextDay,
  startOfLocalDay,
  validateDayRange,
} from "../local-days";

const iso = (date: Date | null) => date?.toISOString();

describe("startOfLocalDay", () => {
  it("is local midnight, not UTC midnight", () => {
    expect(iso(startOfLocalDay("2026-01-15", "America/New_York"))).toBe(
      "2026-01-15T05:00:00.000Z",
    );
    expect(iso(startOfLocalDay("2026-07-15", "America/New_York"))).toBe(
      "2026-07-15T04:00:00.000Z",
    );
    expect(iso(startOfLocalDay("2026-07-15", "Asia/Tokyo"))).toBe(
      "2026-07-14T15:00:00.000Z",
    );
    expect(iso(startOfLocalDay("2026-07-15", "UTC"))).toBe(
      "2026-07-15T00:00:00.000Z",
    );
  });

  it("follows the clock change on the days it happens", () => {
    expect(iso(startOfLocalDay("2026-03-08", "America/New_York"))).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(iso(startOfLocalDay("2026-03-09", "America/New_York"))).toBe(
      "2026-03-09T04:00:00.000Z",
    );
    expect(iso(startOfLocalDay("2026-11-01", "America/New_York"))).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    expect(iso(startOfLocalDay("2026-11-02", "America/New_York"))).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });
});

describe("instantsForDayRange", () => {
  it("covers each end day completely, even a 23 hour one", () => {
    const { from, before } = instantsForDayRange(
      { from: "2026-03-08", to: "2026-03-08" },
      "America/New_York",
    );
    expect(iso(from)).toBe("2026-03-08T05:00:00.000Z");
    expect(iso(before)).toBe("2026-03-09T04:00:00.000Z");
    expect(before!.getTime() - from!.getTime()).toBe(23 * 3_600_000);
  });

  it("leaves an open end open", () => {
    expect(instantsForDayRange({ from: "2026-01-01" }, "UTC")).toEqual({
      from: new Date("2026-01-01T00:00:00Z"),
      before: null,
    });
    expect(instantsForDayRange({}, "UTC")).toEqual({
      from: null,
      before: null,
    });
  });
});

describe("nextDay", () => {
  it("rolls over months and years", () => {
    expect(nextDay("2026-01-31")).toBe("2026-02-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("validateDayRange", () => {
  it("accepts equal and ordered days and open ends", () => {
    expect(validateDayRange({ from: "2026-01-01", to: "2026-01-01" })).toEqual(
      [],
    );
    expect(validateDayRange({ from: "2026-01-01" })).toEqual([]);
    expect(validateDayRange({ to: "2026-01-01" })).toEqual([]);
  });

  it("rejects a range that ends before it starts", () => {
    expect(
      validateDayRange({ from: "2026-02-01", to: "2026-01-01" }),
    ).toMatchObject([{ field: "to", code: "date_range_inverted" }]);
  });
});

describe("isTimeZone", () => {
  it("accepts IANA names only", () => {
    expect(isTimeZone("America/New_York")).toBe(true);
    expect(isTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});
