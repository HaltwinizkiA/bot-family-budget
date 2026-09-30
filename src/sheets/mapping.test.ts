import { describe, expect, it } from "vitest";
import { cellsToRow, columnAState, parseSheetEuros, rowToCells, sheetTitle } from "./mapping.js";

describe("columnAState", () => {
  it("starts at row 5 with id 1 when column A is empty", () => {
    expect(columnAState(undefined)).toEqual({ maxId: 0, nextRow: 5 });
    expect(columnAState([])).toEqual({ maxId: 0, nextRow: 5 });
  });

  it("appends after the last used id cell and skips holes for the next id", () => {
    expect(columnAState([[1], [], [3]])).toEqual({ maxId: 3, nextRow: 8 });
  });
});

describe("row cells", () => {
  it("round-trips cents through raw sheet numbers", () => {
    const cells = rowToCells({
      id: 1,
      dateIso: "2026-09-30T22:00:00+02:00",
      sumCents: -2550,
      category: "Groceries",
      comment: "молоко",
      createdBy: "anna",
      balanceCents: 27450,
    });
    expect(cells[1]).toBe("2026-09-30T22:00:00+02:00");
    expect(cells[2]).toBe(-25.5);
    expect(cellsToRow(cells)).toMatchObject({
      id: 1,
      sumCents: -2550,
      category: "Groceries",
      comment: "молоко",
      createdBy: "anna",
      balanceCents: 27450,
    });
  });
});

describe("parseSheetEuros", () => {
  it("reads a numeric B1", () => {
    expect(parseSheetEuros(300)).toBe(30000);
    expect(parseSheetEuros("274.50")).toBe(27450);
  });

  it("refuses a blank B1", () => {
    expect(() => parseSheetEuros("")).toThrow();
    expect(() => parseSheetEuros(undefined)).toThrow();
  });
});

describe("sheetTitle", () => {
  it("uses the tab whose sheet id is 0", () => {
    expect(
      sheetTitle([
        { properties: { sheetId: 4, title: "Other" } },
        { properties: { sheetId: 0, title: "Family budget" } },
      ]),
    ).toBe("Family budget");
  });
});
