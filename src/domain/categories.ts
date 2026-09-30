import type { ExpenseCategory } from "./types.js";

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Groceries",
  "Household",
  "Gifts",
  "Restaurants & Cafés",
  "Transport",
  "Entertainment",
  "Miscellaneous",
] as const satisfies readonly ExpenseCategory[];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}
