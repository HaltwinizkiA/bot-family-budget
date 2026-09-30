import { isExpenseCategory } from "../domain/categories.js";
import { InsufficientFundsError, InputError, SaveFailedError } from "../domain/errors.js";
import { formatIsoBerlin } from "../domain/clock.js";
import { formatEuros } from "../domain/money.js";
import type { ExpenseCategory, StoredRow } from "../domain/types.js";
import type { JournalStore } from "./types.js";

export type Mutation =
  | { type: "expense"; amountCents: number; category: ExpenseCategory; comment: string; createdBy: string }
  | { type: "deposit"; amountCents: number; comment: string; createdBy: string };

export class WriteQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: JournalStore,
    private readonly now: () => Date,
  ) {}

  post(mutation: Mutation): Promise<{ balance: string }> {
    const run = this.tail.then(() => this.apply(mutation));
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async apply(mutation: Mutation): Promise<{ balance: string }> {
    if (mutation.type === "expense" && !isExpenseCategory(mutation.category)) {
      throw new InputError("Выберите категорию");
    }
    const balance = await this.store.readBalance();
    const snap = await this.store.readColumnA();
    const signed = mutation.type === "expense" ? -mutation.amountCents : mutation.amountCents;
    if (balance + signed < 0) throw new InsufficientFundsError();
    const next = balance + signed;
    const row: StoredRow = {
      id: snap.maxId + 1,
      dateIso: formatIsoBerlin(this.now()),
      sumCents: signed,
      category: mutation.type === "expense" ? mutation.category : "income",
      comment: mutation.comment,
      createdBy: mutation.createdBy,
      balanceCents: next,
    };
    try {
      await this.store.appendAt(snap.nextRow, row);
    } catch {
      throw new SaveFailedError();
    }
    let wrote = false;
    for (let attempt = 0; attempt < 3 && !wrote; attempt += 1) {
      try {
        await this.store.writeBalance(next);
        wrote = true;
      } catch {
        wrote = false;
      }
    }
    let actual: number | null = null;
    try {
      actual = await this.store.readBalance();
    } catch {
      actual = null;
    }
    if (wrote && actual === next) return { balance: formatEuros(next) };
    try {
      await this.store.deleteRow(snap.nextRow);
    } catch {
      /* the user still must not see success */
    }
    try {
      const current = await this.store.readBalance();
      if (current !== balance) await this.store.writeBalance(balance);
    } catch {
      /* B1 may need a manual check after a crash mid-write */
    }
    throw new SaveFailedError();
  }
}
