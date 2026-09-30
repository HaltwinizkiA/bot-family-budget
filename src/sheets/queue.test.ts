import { describe, expect, it } from "vitest";
import { MemorySheets } from "./memory.js";
import { WriteQueue } from "./queue.js";
import { InsufficientFundsError, SaveFailedError } from "../domain/errors.js";
import type { StoredRow } from "../domain/types.js";

const NOW = new Date("2026-09-30T20:00:00.000Z");

function queue(store: MemorySheets, now = () => NOW): WriteQueue {
  return new WriteQueue(store, now);
}

describe("write queue", () => {
  it("records an expense and the balance after it", async () => {
    const store = new MemorySheets(30000);
    const result = await queue(store).post({
      type: "expense",
      amountCents: 2550,
      category: "Groceries",
      comment: "молоко",
      createdBy: "anna",
    });
    expect(result.balance).toBe("274.50");
    expect(store.balanceCents).toBe(27450);
    expect([...store.rows.values()][0]).toMatchObject({
      id: 1,
      dateIso: "2026-09-30T22:00:00+02:00",
      sumCents: -2550,
      category: "Groceries",
      comment: "молоко",
      createdBy: "anna",
      balanceCents: 27450,
    });
  });

  it("serializes two overlapping writes into distinct ids and one final balance", async () => {
    const store = new MemorySheets(27450);
    store.seed(5, row(1, -2550, 27450));
    store.readDelayMs = 30;
    const q = queue(store);
    await Promise.all([
      q.post({ type: "deposit", amountCents: 5000, comment: "", createdBy: "anna" }),
      q.post({ type: "expense", amountCents: 1000, category: "Transport", comment: "", createdBy: "max" }),
    ]);
    expect(store.maxBalanceReadsInFlight).toBe(1);
    expect(store.balanceCents).toBe(31450);
    const written = [...store.rows.values()].filter((item) => item.id > 1);
    expect(written.map((item) => item.id).sort()).toEqual([2, 3]);
    expect(written.map((item) => item.sumCents).sort((a, b) => a - b)).toEqual([-1000, 5000]);
    const last = written.find((item) => item.id === 3);
    expect(last?.balanceCents).toBe(31450);
  });

  it("rejects an expense that would pass below zero and writes nothing", async () => {
    const store = new MemorySheets(1000);
    await expect(
      queue(store).post({
        type: "expense",
        amountCents: 1001,
        category: "Groceries",
        comment: "",
        createdBy: "anna",
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(store.balanceCents).toBe(1000);
    expect(store.rows.size).toBe(0);
  });

  it("allows a balance of exactly zero", async () => {
    const store = new MemorySheets(1000);
    const result = await queue(store).post({
      type: "expense",
      amountCents: 1000,
      category: "Groceries",
      comment: "",
      createdBy: "anna",
    });
    expect(result.balance).toBe("0.00");
    expect(store.balanceCents).toBe(0);
  });

  it("leaves the sheet unchanged when the append fails", async () => {
    const store = new MemorySheets(30000);
    store.appendFailures = 1;
    await expect(
      queue(store).post({
        type: "expense",
        amountCents: 100,
        category: "Rent",
        comment: "",
        createdBy: "anna",
      }),
    ).rejects.toBeInstanceOf(SaveFailedError);
    expect(store.balanceCents).toBe(30000);
    expect(store.rows.size).toBe(0);
  });

  it("removes the new row when the balance write keeps failing", async () => {
    const store = new MemorySheets(30000);
    store.writeBalanceFailures = 3;
    await expect(
      queue(store).post({
        type: "expense",
        amountCents: 100,
        category: "Rent",
        comment: "",
        createdBy: "anna",
      }),
    ).rejects.toBeInstanceOf(SaveFailedError);
    expect(store.rows.size).toBe(0);
    expect(store.balanceCents).toBe(30000);
  });

  it("succeeds when the balance write fails once and then sticks", async () => {
    const store = new MemorySheets(30000);
    store.writeBalanceFailures = 1;
    const result = await queue(store).post({
      type: "deposit",
      amountCents: 100,
      comment: "",
      createdBy: "anna",
    });
    expect(result.balance).toBe("301.00");
    expect(store.rows.size).toBe(1);
  });
});

function row(id: number, sumCents: number, balanceCents: number): StoredRow {
  return {
    id,
    dateIso: "2026-09-30T21:00:00+02:00",
    sumCents,
    category: "Groceries",
    comment: "",
    createdBy: "anna",
    balanceCents,
  };
}
