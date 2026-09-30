import type { StoredRow } from "../domain/types.js";

export type JournalStore = {
  readBalance(): Promise<number>;
  readColumnA(): Promise<{ maxId: number; nextRow: number }>;
  appendAt(rowNumber: number, row: StoredRow): Promise<void>;
  writeBalance(cents: number): Promise<void>;
  deleteRow(rowNumber: number): Promise<void>;
  readJournal(): Promise<StoredRow[]>;
};
