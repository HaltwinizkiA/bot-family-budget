import { describe, expect, it } from "vitest";
import { berlinYmd, formatIsoBerlin, presetRange, ymdKey } from "./clock.js";

describe("formatIsoBerlin", () => {
  it("writes the commit instant in Europe/Berlin with a numeric offset", () => {
    expect(formatIsoBerlin(new Date("2026-09-30T20:00:00.000Z"))).toBe("2026-09-30T22:00:00+02:00");
  });

  it("switches offset across the March and October boundaries", () => {
    expect(formatIsoBerlin(new Date("2026-03-29T00:30:00.000Z"))).toBe("2026-03-29T01:30:00+01:00");
    expect(formatIsoBerlin(new Date("2026-03-29T01:30:00.000Z"))).toBe("2026-03-29T03:30:00+02:00");
    expect(formatIsoBerlin(new Date("2026-10-25T00:30:00.000Z"))).toBe("2026-10-25T02:30:00+02:00");
    expect(formatIsoBerlin(new Date("2026-10-25T02:30:00.000Z"))).toBe("2026-10-25T03:30:00+01:00");
  });

  it("rolls the calendar date at Berlin midnight", () => {
    expect(formatIsoBerlin(new Date("2026-10-01T22:00:00.000Z"))).toBe("2026-10-02T00:00:00+02:00");
  });
});

describe("presetRange", () => {
  const today = new Date("2026-10-01T10:00:00+02:00");

  it("uses the calendar month, the calendar quarter-to-date, and the calendar year", () => {
    expect(ymdKey(berlinYmd(today))).toBe("2026-10-01");
    expect(bounds("month")).toEqual(["2026-10-01", "2026-10-31"]);
    expect(bounds("quarter")).toEqual(["2026-08-01", "2026-10-31"]);
    expect(bounds("year")).toEqual(["2026-01-01", "2026-12-31"]);
  });

  function bounds(preset: "month" | "quarter" | "year"): [string, string] {
    const range = presetRange(preset, today);
    return [ymdKey(range.from), ymdKey(range.to)];
  }
});
