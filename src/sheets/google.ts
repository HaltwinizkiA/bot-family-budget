import { google } from "googleapis";
import type { StoredRow } from "../domain/types.js";
import { a1, cellsToRow, columnAState, parseSheetEuros, rowToCells, sheetTitle } from "./mapping.js";
import type { JournalStore } from "./types.js";

type SheetsClient = ReturnType<typeof google.sheets>;

export async function createGoogleJournal(spreadsheetId: string, keyFile: string): Promise<JournalStore> {
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const title = sheetTitle(meta.data.sheets ?? []);
  return new GoogleJournal(sheets, spreadsheetId, title);
}

class GoogleJournal implements JournalStore {
  constructor(
    private readonly sheets: SheetsClient,
    private readonly spreadsheetId: string,
    private readonly title: string,
  ) {}

  async readBalance(): Promise<number> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: a1(this.title, "B1"),
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return parseSheetEuros(response.data.values?.[0]?.[0]);
  }

  async readColumnA(): Promise<{ maxId: number; nextRow: number }> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: a1(this.title, "A5:A"),
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    return columnAState(response.data.values ?? []);
  }

  async appendAt(rowNumber: number, row: StoredRow): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: a1(this.title, `A${rowNumber}:G${rowNumber}`),
      valueInputOption: "RAW",
      requestBody: { values: [rowToCells(row)] },
    });
  }

  async writeBalance(cents: number): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: a1(this.title, "B1"),
      valueInputOption: "RAW",
      requestBody: { values: [[cents / 100]] },
    });
  }

  async deleteRow(rowNumber: number): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: "ROWS",
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      },
    });
  }

  async readJournal(): Promise<StoredRow[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: a1(this.title, "A5:G"),
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows: StoredRow[] = [];
    for (const cells of response.data.values ?? []) {
      const row = cellsToRow(cells);
      if (row) rows.push(row);
    }
    return rows;
  }
}
