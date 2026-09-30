import { describe, expect, it } from "vitest";
import { parseTransaction } from "./validate.js";
import { InputError } from "./errors.js";
import { EXPENSE_CATEGORIES } from "./categories.js";

describe("parseTransaction", () => {
  it("stores an expense as a positive cent amount plus one of the eight categories", () => {
    expect(
      parseTransaction({ type: "expense", amount: "25.5", category: "Groceries", comment: " молоко " }),
    ).toEqual({
      type: "expense",
      amountCents: 2550,
      category: "Groceries",
      comment: "молоко",
    });
  });

  it("refuses income on the expense path", () => {
    expect(() => parseTransaction({ type: "expense", amount: "10", category: "income" })).toThrow(InputError);
  });

  it("lists exactly the eight sheet literals and not income", () => {
    expect([...EXPENSE_CATEGORIES]).toEqual([
      "Rent",
      "Groceries",
      "Household",
      "Gifts",
      "Restaurants & Cafés",
      "Transport",
      "Entertainment",
      "Miscellaneous",
    ]);
  });

  it("turns a deposit into a positive amount and ignores a client category", () => {
    expect(parseTransaction({ type: "deposit", amount: "50", category: "Rent", comment: "" })).toEqual({
      type: "deposit",
      amountCents: 5000,
      comment: "",
    });
  });

  it("rejects a comment longer than 200 characters", () => {
    expect(() => parseTransaction({ type: "deposit", amount: "1", comment: "а".repeat(201) })).toThrow(InputError);
    expect(parseTransaction({ type: "deposit", amount: "1", comment: "а".repeat(200) }).comment).toHaveLength(200);
  });

  it("rejects a non-positive amount", () => {
    expect(() => parseTransaction({ type: "expense", amount: "0", category: "Rent" })).toThrow(InputError);
  });
});
