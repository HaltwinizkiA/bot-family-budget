import { isExpenseCategory } from "./categories.js";
import { InputError } from "./errors.js";
import { parseAmount } from "./money.js";
import type { ExpenseCategory } from "./types.js";

export type TransactionInput =
  | { type: "expense"; amountCents: number; category: ExpenseCategory; comment: string }
  | { type: "deposit"; amountCents: number; comment: string };

export function parseTransaction(body: unknown): TransactionInput {
  if (!body || typeof body !== "object") throw new InputError("Введите сумму больше 0");
  const record = body as Record<string, unknown>;
  let amountCents: number;
  try {
    amountCents = parseAmount(typeof record.amount === "string" ? record.amount : "");
  } catch {
    throw new InputError("Введите сумму больше 0");
  }
  const comment = commentOf(record.comment);
  if (record.type === "deposit") return { type: "deposit", amountCents, comment };
  if (record.type !== "expense") throw new InputError("Введите сумму больше 0");
  if (typeof record.category !== "string" || !isExpenseCategory(record.category)) {
    throw new InputError("Выберите категорию");
  }
  return { type: "expense", amountCents, category: record.category, comment };
}

function commentOf(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if ([...text].length > 200) throw new InputError("Комментарий не длиннее 200 символов");
  return text;
}
