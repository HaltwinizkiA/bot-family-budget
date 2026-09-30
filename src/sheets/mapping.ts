import { eurosNumberToCents } from "../domain/money.js";
import type { StoredRow } from "../domain/types.js";

export function columnAState(values: unknown[][] | null | undefined): { maxId: number; nextRow: number } {
  const rows = values ?? [];
  let maxId = 0;
  let lastUsed = -1;
  rows.forEach((row, index) => {
    const cell = row?.[0];
    if (cell === undefined || cell === null || cell === "") return;
    lastUsed = index;
    const numeric = typeof cell === "number" ? cell : Number(String(cell).trim());
    if (Number.isInteger(numeric) && numeric > maxId) maxId = numeric;
  });
  return { maxId, nextRow: lastUsed < 0 ? 5 : 5 + lastUsed + 1 };
}

export function rowToCells(row: StoredRow): (string | number)[] {
  return [
    row.id,
    row.dateIso,
    row.sumCents / 100,
    row.category,
    row.comment,
    row.createdBy,
    row.balanceCents / 100,
  ];
}

export function cellsToRow(cells: unknown[]): StoredRow | null {
  if (cells.length < 7 || cells[0] === undefined || cells[0] === "") return null;
  const id = typeof cells[0] === "number" ? cells[0] : Number(String(cells[0]).trim());
  if (!Number.isInteger(id)) return null;
  try {
    return {
      id,
      dateIso: String(cells[1] ?? ""),
      sumCents: parseSheetEuros(cells[2]),
      category: String(cells[3] ?? ""),
      comment: cells[4] === undefined || cells[4] === null ? "" : String(cells[4]),
      createdBy: String(cells[5] ?? ""),
      balanceCents: parseSheetEuros(cells[6]),
    };
  } catch {
    return null;
  }
}

export function parseSheetEuros(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return eurosNumberToCents(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) return eurosNumberToCents(parsed);
  }
  throw new Error("B1 is not numeric");
}

export function sheetTitle(
  sheets: { properties?: { sheetId?: number | null; title?: string | null } }[],
): string {
  const title = sheets.find((sheet) => sheet.properties?.sheetId === 0)?.properties?.title;
  if (!title) throw new Error("gid=0 sheet not found");
  return title;
}

export function a1(title: string, range: string): string {
  return `'${title.replaceAll("'", "''")}'!${range}`;
}
