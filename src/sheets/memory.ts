import type { StoredRow } from "../domain/types.js";
import type { JournalStore } from "./types.js";
import { columnAState } from "./mapping.js";

export class MemorySheets implements JournalStore {
  balanceCents: number;
  rows = new Map<number, StoredRow>();
  appendFailures = 0;
  writeBalanceFailures = 0;
  readDelayMs = 0;
  maxBalanceReadsInFlight = 0;
  private balanceReadsInFlight = 0;

  constructor(balanceCents: number) {
    this.balanceCents = balanceCents;
  }

  seed(rowNumber: number, row: StoredRow): void {
    this.rows.set(rowNumber, row);
  }

  async readBalance(): Promise<number> {
    this.balanceReadsInFlight += 1;
    this.maxBalanceReadsInFlight = Math.max(this.maxBalanceReadsInFlight, this.balanceReadsInFlight);
    if (this.readDelayMs > 0) await delay(this.readDelayMs);
    this.balanceReadsInFlight -= 1;
    return this.balanceCents;
  }

  async readColumnA(): Promise<{ maxId: number; nextRow: number }> {
    const rowNumbers = [...this.rows.keys()];
    const maxRow = rowNumbers.length === 0 ? 4 : Math.max(...rowNumbers);
    const values: unknown[][] = [];
    for (let row = 5; row <= maxRow; row += 1) {
      const stored = this.rows.get(row);
      values.push(stored ? [stored.id] : []);
    }
    return columnAState(values);
  }

  async appendAt(rowNumber: number, row: StoredRow): Promise<void> {
    if (this.appendFailures > 0) {
      this.appendFailures -= 1;
      throw new Error("append failed");
    }
    this.rows.set(rowNumber, row);
  }

  async writeBalance(cents: number): Promise<void> {
    if (this.writeBalanceFailures > 0) {
      this.writeBalanceFailures -= 1;
      throw new Error("write failed");
    }
    this.balanceCents = cents;
  }

  async deleteRow(rowNumber: number): Promise<void> {
    this.rows.delete(rowNumber);
  }

  async readJournal(): Promise<StoredRow[]> {
    return [...this.rows.entries()]
      .sort((left, right) => left[0] - right[0])
      .map((entry) => entry[1]);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
