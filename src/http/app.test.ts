import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { MemorySheets } from "../sheets/memory.js";
import { WriteQueue } from "../sheets/queue.js";
import { signInitData } from "../test/signInitData.js";
import type { StoredRow } from "../domain/types.js";

const TOKEN = "123456:TEST";
const NOW = new Date("2026-10-01T10:00:00+02:00");

function initData(user: { id: number; username?: string }): string {
  return signInitData(TOKEN, {
    auth_date: String(Math.floor(NOW.getTime() / 1000)),
    user: JSON.stringify(user),
  });
}

function build(store = new MemorySheets(30000), allowedUserIds: ReadonlySet<number> = new Set<number>([7, 8])) {
  const app = createApp({
    botToken: TOKEN,
    queue: new WriteQueue(store, () => NOW),
    store,
    now: () => NOW,
    allowedUserIds,
  });
  return { app, store };
}

describe("http api", () => {
  it("refuses a write when initData is missing or forged", async () => {
    const { app, store } = build();
    const missing = await app.request("/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "expense", amount: "1", category: "Rent" }),
    });
    expect(missing.status).toBe(401);
    const forged = await app.request("/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "tma auth_date=1&user=%7B%22id%22%3A1%7D&hash=dead",
      },
      body: JSON.stringify({ type: "expense", amount: "1", category: "Rent", createdBy: "hacker" }),
    });
    expect(forged.status).toBe(401);
    expect(store.rows.size).toBe(0);
    expect(store.balanceCents).toBe(30000);
  });

  it("writes the username from initData, not from the body", async () => {
    const { app, store } = build();
    const response = await app.request("/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `tma ${initData({ id: 7, username: "anna" })}`,
      },
      body: JSON.stringify({
        type: "expense",
        amount: "25.50",
        category: "Groceries",
        comment: "молоко",
        createdBy: "hacker",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ balance: "274.50" });
    expect([...store.rows.values()][0]).toMatchObject({ createdBy: "anna", sumCents: -2550, category: "Groceries" });
  });

  it("stores a deposit as income even without a category", async () => {
    const { app, store } = build();
    const response = await app.request("/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `tma ${initData({ id: 8 })}`,
      },
      body: JSON.stringify({ type: "deposit", amount: "50.00", comment: "" }),
    });
    expect(response.status).toBe(200);
    expect([...store.rows.values()][0]).toMatchObject({
      sumCents: 5000,
      category: "income",
      createdBy: "id:8",
      balanceCents: 35000,
    });
  });

  it("rejects income as an expense category", async () => {
    const { app, store } = build();
    const response = await app.request("/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `tma ${initData({ id: 7, username: "anna" })}`,
      },
      body: JSON.stringify({ type: "expense", amount: "10", category: "income" }),
    });
    expect(response.status).toBe(400);
    expect(store.rows.size).toBe(0);
  });

  it("returns the sheet balance with two decimals", async () => {
    const { app } = build(new MemorySheets(30000));
    const response = await app.request("/api/balance", {
      headers: { authorization: `tma ${initData({ id: 7, username: "anna" })}` },
    });
    expect(await response.json()).toEqual({ balance: "300.00" });
  });

  it("returns the calendar-month pie and rejects a from-date before the journal", async () => {
    const store = new MemorySheets(10000);
    store.seed(5, sample("2026-09-15T12:00:00+02:00", -12000, "Rent"));
    store.seed(6, sample("2026-10-02T12:00:00+02:00", -2500, "Groceries"));
    store.seed(7, sample("2026-10-03T12:00:00+02:00", 5000, "income"));
    const { app } = build(store);
    const headers = { authorization: `tma ${initData({ id: 7, username: "anna" })}` };
    const pie = await app.request("/api/report?preset=month", { headers });
    expect(await pie.json()).toMatchObject({
      empty: false,
      slices: [{ category: "Groceries", amount: "25.00" }],
    });
    const bad = await app.request("/api/report?from=2026-08-31&to=2026-10-01", { headers });
    expect(bad.status).toBe(400);
  });

  it("lets a listed id read the balance", async () => {
    const { app } = build(new MemorySheets(30000), new Set<number>([7]));
    const response = await app.request("/api/balance", {
      headers: { authorization: `tma ${initData({ id: 7 })}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ balance: "300.00" });
  });

  it("denies a signed id that is not listed and writes no journal row", async () => {
    const { app, store } = build();
    const payload = JSON.stringify({ type: "expense", amount: "1", category: "Rent" });
    const missing = await app.request("/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    const foreign = await app.request("/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `tma ${initData({ id: 9, username: "anna" })}`,
      },
      body: payload,
    });
    const missingBody = await missing.json();
    const foreignBody = await foreign.json();
    expect(foreign.status).toBe(401);
    expect(foreign.status).toBe(missing.status);
    expect(foreignBody).toEqual({ error: "Не авторизовано" });
    expect(foreignBody).toEqual(missingBody);
    expect(store.rows.size).toBe(0);
    expect(store.balanceCents).toBe(30000);

    const headers = { authorization: `tma ${initData({ id: 9 })}` };
    const balance = await app.request("/api/balance", { headers });
    const report = await app.request("/api/report", { headers });
    expect(balance.status).toBe(401);
    expect(report.status).toBe(401);
    expect(await balance.json()).toEqual(missingBody);
    expect(await report.json()).toEqual(missingBody);
  });

  it("denies a valid id when the allow-list is empty", async () => {
    const { app } = build(new MemorySheets(30000), new Set<number>());
    const denied = await app.request("/api/balance", {
      headers: { authorization: `tma ${initData({ id: 7 })}` },
    });
    const missing = await app.request("/api/balance");
    const deniedBody = await denied.json();
    const missingBody = await missing.json();
    expect(denied.status).toBe(401);
    expect(denied.status).toBe(missing.status);
    expect(deniedBody).toEqual({ error: "Не авторизовано" });
    expect(deniedBody).toEqual(missingBody);
  });
});

function sample(dateIso: string, sumCents: number, category: string): StoredRow {
  return {
    id: 1,
    dateIso,
    sumCents,
    category,
    comment: "",
    createdBy: "anna",
    balanceCents: 0,
  };
}
