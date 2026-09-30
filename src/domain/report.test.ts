import { describe, expect, it } from "vitest";
import { customRangeError, earliestYmd, expenseSlices } from "./report.js";
import { presetRange, ymdKey } from "./clock.js";
import type { StoredRow, Ymd } from "./types.js";

function row(partial: Partial<StoredRow> & Pick<StoredRow, "dateIso" | "sumCents" | "category">): StoredRow {
  return {
    id: 1,
    comment: "",
    createdBy: "anna",
    balanceCents: 0,
    ...partial,
  };
}

const october = new Date("2026-10-01T10:00:00+02:00");

describe("expenseSlices", () => {
  it("keeps only expenses inside the calendar month", () => {
    const slices = expenseSlices(
      [
        row({ dateIso: "2026-09-15T12:00:00+02:00", sumCents: -12000, category: "Rent" }),
        row({ dateIso: "2026-10-02T12:00:00+02:00", sumCents: -2500, category: "Groceries" }),
        row({ dateIso: "2026-10-03T12:00:00+02:00", sumCents: 5000, category: "income" }),
      ],
      presetRange("month", october),
    );
    expect(slices).toEqual([{ category: "Groceries", amount: "25.00" }]);
  });

  it("is empty when the range has no expenses", () => {
    const slices = expenseSlices(
      [row({ dateIso: "2026-10-03T12:00:00+02:00", sumCents: 5000, category: "income" })],
      presetRange("month", october),
    );
    expect(slices).toEqual([]);
  });

  it("sums the same category and keeps enum order", () => {
    const slices = expenseSlices(
      [
        row({ id: 1, dateIso: "2026-10-02T12:00:00+02:00", sumCents: -1000, category: "Transport" }),
        row({ id: 2, dateIso: "2026-10-04T12:00:00+02:00", sumCents: -500, category: "Groceries" }),
        row({ id: 3, dateIso: "2026-10-05T12:00:00+02:00", sumCents: -250, category: "Transport" }),
      ],
      presetRange("month", october),
    );
    expect(slices).toEqual([
      { category: "Groceries", amount: "5.00" },
      { category: "Transport", amount: "12.50" },
    ]);
  });
});

describe("custom range", () => {
  const today: Ymd = { year: 2026, month: 10, day: 1 };
  const earliest: Ymd = { year: 2026, month: 9, day: 1 };

  it("rejects a from-date before the earliest journal date", () => {
    expect(
      customRangeError({ year: 2026, month: 8, day: 31 }, { year: 2026, month: 9, day: 30 }, today, earliest),
    ).toBeTruthy();
  });

  it("rejects a to-date after today in Berlin", () => {
    expect(
      customRangeError({ year: 2026, month: 9, day: 1 }, { year: 2026, month: 10, day: 2 }, today, earliest),
    ).toBeTruthy();
  });

  it("accepts an inclusive range inside the bounds", () => {
    expect(
      customRangeError({ year: 2026, month: 9, day: 1 }, { year: 2026, month: 10, day: 1 }, today, earliest),
    ).toBeNull();
  });

  it("has no lower bound when the journal is empty", () => {
    expect(
      customRangeError({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 10, day: 1 }, today, null),
    ).toBeNull();
  });
});

describe("earliestYmd", () => {
  it("returns the earliest Berlin calendar date", () => {
    const earliest = earliestYmd([
      row({ dateIso: "2026-09-01T00:30:00+02:00", sumCents: -100, category: "Rent" }),
      row({ dateIso: "2026-10-01T12:00:00+02:00", sumCents: -100, category: "Rent" }),
    ]);
    expect(earliest && ymdKey(earliest)).toBe("2026-09-01");
  });

  it("returns null for an empty journal", () => {
    expect(earliestYmd([])).toBeNull();
  });
});
