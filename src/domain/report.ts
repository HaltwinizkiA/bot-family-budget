import { EXPENSE_CATEGORIES, isExpenseCategory } from "./categories.js";
import { compareYmd, parseIsoToYmd, ymdKey } from "./clock.js";
import { formatEuros } from "./money.js";
import type { DateRange, ExpenseCategory, StoredRow, Ymd } from "./types.js";

export type Slice = { category: ExpenseCategory; amount: string };

export function expenseSlices(rows: StoredRow[], range: DateRange): Slice[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const row of rows) {
    if (row.sumCents >= 0 || row.category === "income" || !isExpenseCategory(row.category)) continue;
    const day = parseIsoToYmd(row.dateIso);
    if (!day) continue;
    if (compareYmd(day, range.from) < 0 || compareYmd(day, range.to) > 0) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + Math.abs(row.sumCents));
  }
  const slices: Slice[] = [];
  for (const category of EXPENSE_CATEGORIES) {
    const cents = totals.get(category);
    if (!cents) continue;
    slices.push({ category, amount: formatEuros(cents) });
  }
  return slices;
}

export function earliestYmd(rows: StoredRow[]): Ymd | null {
  let earliest: Ymd | null = null;
  for (const row of rows) {
    const day = parseIsoToYmd(row.dateIso);
    if (!day) continue;
    if (!earliest || compareYmd(day, earliest) < 0) earliest = day;
  }
  return earliest;
}

export function customRangeError(from: Ymd, to: Ymd, today: Ymd, earliest: Ymd | null): string | null {
  if (compareYmd(from, to) > 0) return "Неверный период";
  if (compareYmd(to, today) > 0) return "Неверный период";
  if (earliest && compareYmd(from, earliest) < 0) return "Неверный период";
  return null;
}

export { ymdKey };
