/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "./app.js";
import { enterApp } from "./gate.js";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("mini app", () => {
  it("shows the balance, the tabs, and expense and deposit", async () => {
    const { root } = await start();
    expect(root.textContent).toContain("300.00 €");
    expect(root.querySelector("[data-action='tab-home']")?.textContent).toContain("Home");
    expect(root.querySelector("[data-action='tab-reports']")?.textContent).toContain("Reports");
    expect(actionText(root, "[data-action='expense'], [data-action='deposit']")).toEqual(["Расходы", "Депозит"]);
    expect(root.querySelector("[data-action='add']")).toBeNull();
    expect(root.querySelector("[data-action='type-back']")).toBeNull();
  });

  it("returns home from deposit, categories, and the amount form without posting", async () => {
    const fetchMock = vi.fn(fakeFetch);
    const { root } = await start(fetchMock);
    click(root, "deposit");
    expect(actionText(root, "form button")).toEqual(["ДЕПС", "Отменить"]);
    click(root, "deposit-cancel");
    expect(actionText(root, "[data-action='expense'], [data-action='deposit']")).toEqual(["Расходы", "Депозит"]);

    click(root, "expense");
    click(root, "categories-back");
    expect(actionText(root, "[data-action='expense'], [data-action='deposit']")).toEqual(["Расходы", "Депозит"]);

    click(root, "expense");
    click(root, "category-Groceries");
    expect(root.querySelector("h1")?.textContent).toBe("Продукты");
    expect(actionText(root, "form button")).toEqual(["Отправить", "Отменить"]);
    setInput(root, "expense-amount", "5");
    click(root, "expense-cancel");
    expect(root.textContent).toContain("300.00 €");
    expect(actionText(root, "[data-action='expense'], [data-action='deposit']")).toEqual(["Расходы", "Депозит"]);
    expect(root.querySelector("[data-action='category-Groceries']")).toBeNull();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/transactions"))).toBe(false);
  });

  it("shows Russian category labels and posts the English enum", async () => {
    const { root } = await start();
    click(root, "expense");
    const buttons = [...root.querySelectorAll("[data-action^='category-']")];
    expect(buttons.map((node) => node.textContent)).toEqual([
      "Аренда",
      "Продукты",
      "Быт",
      "Подарки",
      "Рестораны и кафе",
      "Транспорт",
      "Развлечения",
      "Прочее",
    ]);
    expect(buttons.map((node) => node.getAttribute("data-action"))).toEqual([
      "category-Rent",
      "category-Groceries",
      "category-Household",
      "category-Gifts",
      "category-Restaurants & Cafés",
      "category-Transport",
      "category-Entertainment",
      "category-Miscellaneous",
    ]);
  });

  it("keeps ДЕПС disabled until the deposit amount is positive", async () => {
    const { root } = await start();
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
    expect(root.textContent).toContain("Аренда");
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
    expect(root.textContent).toContain("Продукты");
    expect(root.textContent).not.toContain("Groceries");
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
    click(root, "deposit");
    setInput(root, "deposit-amount", "10");
    click(root, "deposit-submit");
    await vi.advanceTimersByTimeAsync(3000);
    expect(root.textContent).toContain("Сохранение…");
    const submit = root.querySelector("[data-action='deposit-submit']") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(actionText(root, "form button")).toEqual(["Сохранение…", "Отменить"]);
    release(json({ balance: "310.00" }));
    await vi.runAllTimersAsync();
  });

  it("keeps the caret in the amount and comment fields", async () => {
    const { root } = await start();
    click(root, "expense");
    click(root, "category-Rent");
    expect(root.querySelector("form.screen-enter")).not.toBeNull();
    typeInto(root, "expense-amount", "12", 2);
    const amount = root.querySelector("#expense-amount") as HTMLInputElement;
    expect(document.activeElement).toBe(amount);
    expect(amount.selectionStart).toBe(2);
    expect(amount.value).toBe("12");
    expect(root.querySelector(".screen-enter")).toBeNull();

    typeInto(root, "expense-comment", "кофе", 4);
    const comment = root.querySelector("#expense-comment") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(comment);
    expect(comment.selectionStart).toBe(4);
    expect(comment.value).toBe("кофе");
    expect(root.querySelector(".screen-enter")).toBeNull();

    click(root, "expense-cancel");
    click(root, "deposit");
    typeInto(root, "deposit-amount", "8", 1);
    const deposit = root.querySelector("#deposit-amount") as HTMLInputElement;
    expect(document.activeElement).toBe(deposit);
    expect(deposit.selectionStart).toBe(1);
    typeInto(root, "deposit-comment", "зарплата", 8);
    const note = root.querySelector("#deposit-comment") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(note);
    expect(note.selectionStart).toBe(8);
    expect(note.value).toBe("зарплата");
  });

  it("renders a fake 404 for missing initData or a 401 and does not render the add button", async () => {
    const fetchMock = vi.fn();
    document.title = "Family Budget";
    document.body.innerHTML = "<h1>Home</h1><button data-action='add'>Add</button><p class='balance'>300.00 €</p>";
    await enterApp({ initData: "", fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.title).toBe("404");
    expect(document.querySelector("#not-found-title")?.textContent).toBe("404");
    expect(document.querySelector("#not-found-text")?.textContent).toBe("Not found");
    expect(document.querySelector("[data-action='add']")).toBeNull();
    expect(document.querySelector("[data-action='expense']")).toBeNull();
    expect(document.querySelector("[data-action='tab-home']")).toBeNull();
    expect(document.querySelector("[data-action='tab-reports']")).toBeNull();
    expect(document.body.textContent).not.toContain("Family Budget");
    expect(document.body.textContent).not.toContain("Не авторизовано");
    expect(document.body.textContent).not.toContain("300.00");

    document.title = "Family Budget";
    document.body.innerHTML = "<h1>Home</h1><button data-action='add'>Add</button>";
    await enterApp({ initData: "   ", fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.title).toBe("404");
    expect(document.querySelector("#not-found-text")?.textContent).toBe("Not found");
    expect(document.querySelector("[data-action='add']")).toBeNull();

    let release: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const waiting = vi.fn(() => pending);
    document.title = "Family Budget";
    document.body.innerHTML = "<h1>Home</h1><button data-action='add'>Add</button><p class='balance'>300.00 €</p>";
    const entered = enterApp({ initData: "signed", fetch: waiting });
    expect(document.querySelector("[data-action='expense']")).toBeNull();
    expect(document.querySelector("[data-action='tab-home']")).toBeNull();
    expect(document.body.textContent).not.toContain("Расходы");
    release(json({ error: "Не авторизовано" }, 401));
    await entered;
    expect(waiting).toHaveBeenCalledWith("/api/balance", {
      headers: { authorization: "tma signed" },
    });
    expect(document.title).toBe("404");
    expect(document.querySelector("#not-found-title")?.textContent).toBe("404");
    expect(document.querySelector("#not-found-text")?.textContent).toBe("Not found");
    expect(document.body.textContent).not.toContain("Не авторизовано");
    expect(document.body.textContent).not.toContain("access denied");
    expect(document.body.textContent).not.toContain("300.00");
    expect(document.querySelector("[data-action='add']")).toBeNull();
    expect(document.querySelector("[data-action='expense']")).toBeNull();
    expect(document.querySelector("[data-action='tab-home']")).toBeNull();
    expect(document.querySelector("#app")).toBeNull();
  });

  it("opens the current Home flow when balance is not a 401", async () => {
    document.title = "404";
    document.body.innerHTML = "<h1 id='not-found-title'>404</h1><p id='not-found-text'>Not found</p>";
    const seen: string[] = [];
    await enterApp({
      initData: " signed ",
      fetch: fakeFetch,
      prepare: () => {
        seen.push(document.querySelector("[data-action='expense']") ? "home" : "before-home");
      },
    });
    await flush();
    expect(seen).toEqual(["before-home"]);
    expect(document.title).toBe("Family Budget");
    expect(document.documentElement.lang).toBe("ru");
    expect(document.body.textContent).toContain("300.00 €");
    expect(document.querySelector("[data-action='tab-home']")?.textContent).toBe("Home");
    expect(document.querySelector("[data-action='tab-reports']")?.textContent).toBe("Reports");
    expect(document.querySelector("[data-action='expense']")?.textContent).toBe("Расходы");
    expect(document.querySelector("[data-action='deposit']")?.textContent).toBe("Депозит");
    expect(document.querySelector("#not-found-title")).toBeNull();
    expect(document.querySelector("#not-found-text")).toBeNull();
    expect(document.body.textContent).not.toContain("Not found");
  });

  it("opens Home when the balance call returns 500 or throws", async () => {
    document.body.innerHTML = "<h1 id='not-found-title'>404</h1><p id='not-found-text'>Not found</p>";
    await enterApp({
      initData: "signed",
      fetch: vi.fn(async () => json({ error: "Не удалось сохранить, попробуйте ещё раз" }, 500)),
    });
    expect(document.title).toBe("Family Budget");
    expect(document.querySelector("[data-action='expense']")?.textContent).toBe("Расходы");
    expect(document.querySelector("#not-found-title")).toBeNull();
    expect(document.querySelector("[data-action='add']")).toBeNull();

    document.title = "404";
    document.body.innerHTML = "<h1 id='not-found-title'>404</h1><p id='not-found-text'>Not found</p>";
    await enterApp({
      initData: "signed",
      fetch: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    expect(document.title).toBe("Family Budget");
    expect(document.querySelector("[data-action='tab-reports']")?.textContent).toBe("Reports");
    expect(document.querySelector("#not-found-text")).toBeNull();
  });
});

function actionText(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? "");
}

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

function typeInto(root: HTMLElement, id: string, value: string, caret: number): void {
  const input = root.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!input) throw new Error(`missing #${id}`);
  input.focus();
  input.value = value;
  input.setSelectionRange(caret, caret);
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
