import { describe, expect, it } from "vitest";
import { eurosNumberToCents, formatEuros, parseAmount } from "./money.js";
import { InputError } from "./errors.js";

describe("parseAmount", () => {
  it("accepts a positive amount with one or two decimals", () => {
    expect(parseAmount("25.5")).toBe(2550);
    expect(parseAmount("25.50")).toBe(2550);
    expect(parseAmount("25")).toBe(2500);
    expect(parseAmount(" 10.00 ")).toBe(1000);
  });

  it("rejects empty, zero, negative, comma, and extra precision", () => {
    for (const raw of ["", "0", "0.00", "-1", "abc", "25,5", "25.501", "+25"]) {
      expect(() => parseAmount(raw)).toThrow(InputError);
    }
  });
});

describe("formatEuros", () => {
  it("prints two digits and a dot, with a sign only when negative", () => {
    expect(formatEuros(30000)).toBe("300.00");
    expect(formatEuros(-2550)).toBe("-25.50");
    expect(formatEuros(0)).toBe("0.00");
    expect(formatEuros(100000)).toBe("1000.00");
  });
});

describe("eurosNumberToCents", () => {
  it("rounds a sheet number to cents", () => {
    expect(eurosNumberToCents(300)).toBe(30000);
    expect(eurosNumberToCents(-25.5)).toBe(-2550);
    expect(eurosNumberToCents(274.5)).toBe(27450);
  });
});
