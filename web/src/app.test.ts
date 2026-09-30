/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "./app.js";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("mini app", () => {
  it("shows the balance and the two tabs", async () => {
    const { root } = await start();
    expect(root.textContent).toContain("300.00 €");
    expect(root.querySelector("[data-action='tab-home']")?.textContent).toContain("Home");
    expect(root.querySelector("[data-action='tab-reports']")?.textContent).toContain("Reports");
  });

  it("walks back from the amount screen without posting", async () => {
    const fetchMock = vi.fn(fakeFetch);
    const { root } = await start(fetchMock);
    click(root, "add");
    click(root, "expense");
    click(root, "category-Groceries");
    setInput(root, "expense-amount", "5");
    click(root, "expense-cancel");
    click(root, "categories-back");
    click(root, "type-back");
    expect(root.textContent).toContain("300.00 €");
    expect(root.querySelector("[data-action='add']")).not.toBeNull();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/transactions"))).toBe(false);
  });

  it("shows the eight category literals and not income", async () => {
    const { root } = await start();
    click(root, "add");
    click(root, "expense");
    const labels = [...root.querySelectorAll("[data-action^='category-']")].map((node) => node.textContent);
    expect(labels).toEqual([
      "Rent",
      "Groceries",
      "Household",
      "Gifts",
      "Restaurants & Cafés",
      "Transport",
      "Entertainment",
      "Miscellaneous",
    ]);
  });

  it("keeps ДЕПС disabled until the deposit amount is positive", async () => {
    const { root } = await start();
    click(root, "add");
    click(root, "deposit");
    const button = root.querySelector("[data-action='deposit-submit']") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    setInput(root, "deposit-amount", "0");
    expect((root.querySelector("[data-action='deposit-submit']") as HTMLButtonElement).disabled).toBe(true);
    setInput(root, "deposit-amount", "10");
    expect((root.querySelector("[data-action='deposit-submit']") as HTMLButtonElement).disabled).toBe(false);
  });

  it("sends one request when submit is tapped twice", async () => {
    let posts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/transactions")) {
        posts += 1;
        return json({ balance: "290.00" });
      }
      return fakeFetch(input, init);
    });
    const { root } = await start(fetchMock);
    click(root, "add");
    click(root, "expense");
    click(root, "category-Rent");
    setInput(root, "expense-amount", "10");
    click(root, "expense-submit");
    click(root, "expense-submit");
    await flush();
    expect(posts).toBe(1);
    expect(root.textContent).toContain("290.00 €");
  });

  it("normalizes a single comma before posting", async () => {
    let body = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/transactions")) {
        body = String(init?.body ?? "");
        return json({ balance: "274.50" });
      }
      return fakeFetch(input, init);
    });
    const { root } = await start(fetchMock);
    click(root, "add");
    click(root, "expense");
    click(root, "category-Groceries");
    setInput(root, "expense-amount", "25,50");
    click(root, "expense-submit");
    await flush();
    expect(JSON.parse(body)).toMatchObject({ amount: "25.50", category: "Groceries", type: "expense" });
  });

  it("shows insufficient funds and does not change the balance", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/transactions")) {
        return json({ error: "Недостаточно средств" }, 409);
      }
      return fakeFetch(input, init);
    });
    const { root } = await start(fetchMock);
    click(root, "add");
    click(root, "expense");
    click(root, "category-Rent");
    setInput(root, "expense-amount", "10.01");
    click(root, "expense-submit");
    await flush();
    expect(root.textContent).toContain("Недостаточно средств");
    expect(root.textContent).toContain("300.00 €");
  });

  it("keeps the report range and the add step when switching tabs", async () => {
    const { root } = await start();
    click(root, "tab-reports");
    setInput(root, "report-from", "2026-09-01");
    setInput(root, "report-to", "2026-10-01");
    click(root, "tab-home");
    click(root, "add");
    click(root, "expense");
    click(root, "tab-reports");
    expect((root.querySelector("#report-from") as HTMLInputElement).value).toBe("2026-09-01");
    click(root, "tab-home");
    expect(root.querySelector("[data-action='category-Rent']")).not.toBeNull();
  });

  it("toasts the stub reports and does not ask for another pie", async () => {
    const fetchMock = vi.fn(fakeFetch);
    const { root } = await start(fetchMock);
    const before = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/report")).length;
    click(root, "tab-reports");
    click(root, "stub-authors");
    expect(root.textContent).toContain("В разработке");
    const after = fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/report")).length;
    expect(after).toBe(before);
  });

  it("shows the empty copy instead of a zero pie", async () => {
    const { root } = await start();
    click(root, "tab-reports");
    expect(root.textContent).toContain("Нет расходов за период");
    expect(root.querySelector("svg")).toBeNull();
  });

  it("keeps the current pie when a custom range is rejected", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/report") && url.includes("from=")) return json({ error: "Неверный период" }, 400);
      if (url.includes("/api/report")) {
        return json({ empty: false, earliest: "2026-09-01", slices: [{ category: "Rent", amount: "10.00" }] });
      }
      return fakeFetch(input, init);
    });
    const { root } = await start(fetchMock);
    click(root, "tab-reports");
    setInput(root, "report-from", "2026-08-01");
    setInput(root, "report-to", "2026-10-01");
    await flush();
    expect(root.textContent).toContain("Неверный период");
    expect(root.textContent).toContain("Rent");
    expect(root.textContent).toContain("10.00 €");
  });

  it("shows a slice label with the euro amount", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/report")) {
        return json({
          empty: false,
          earliest: "2026-10-01",
          slices: [{ category: "Groceries", amount: "25.00" }],
        });
      }
      return fakeFetch(input, init);
    });
    const { root } = await start(fetchMock);
    click(root, "tab-reports");
    expect(root.textContent).toContain("Groceries");
    expect(root.textContent).toContain("25.00 €");
    expect(root.querySelector("svg")).not.toBeNull();
  });

  it("shows a waiting label when the save takes longer than three seconds", async () => {
    vi.useFakeTimers();
    let release: (value: Response) => void = () => {};
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/transactions")) {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return fakeFetch(input, init);
    });
    const { root } = await start(fetchMock);
    click(root, "add");
    click(root, "deposit");
    setInput(root, "deposit-amount", "10");
    click(root, "deposit-submit");
    await vi.advanceTimersByTimeAsync(3000);
    expect(root.textContent).toContain("Сохранение…");
    release(json({ balance: "310.00" }));
    await vi.runAllTimersAsync();
  });
});

function click(root: HTMLElement, action: string): void {
  const node = root.querySelector(`[data-action='${action}']`);
  if (!node) throw new Error(`missing ${action}`);
  node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function setInput(root: HTMLElement, id: string, value: string): void {
  const input = root.querySelector(`#${id}`) as HTMLInputElement | null;
  if (!input) throw new Error(`missing #${id}`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function start(fetchImpl: typeof fetch = fakeFetch): Promise<{ root: HTMLElement }> {
  const root = document.createElement("div");
  document.body.append(root);
  mount(root, { initData: "signed", fetch: fetchImpl });
  await flush();
  return { root };
}

async function flush(): Promise<void> {
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeFetch(input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url.includes("/api/balance")) return Promise.resolve(json({ balance: "300.00" }));
  if (url.includes("/api/report")) {
    return Promise.resolve(json({ slices: [], empty: true, earliest: null }));
  }
  return Promise.resolve(json({ error: "missing" }, 404));
}
