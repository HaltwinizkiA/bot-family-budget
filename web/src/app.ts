import { EXPENSE_CATEGORIES } from "@domain/categories.ts";
import { parseAmount } from "@domain/money.ts";
import { pieMarkup } from "./pie.ts";

type Slice = { category: string; amount: string };
type Step = "home" | "type" | "categories" | "amount" | "deposit";
type Tab = "home" | "reports";
type Preset = "month" | "quarter" | "year";

type State = {
  tab: Tab;
  step: Step;
  balance: string | null;
  category: string | null;
  expenseAmount: string;
  expenseComment: string;
  depositAmount: string;
  depositComment: string;
  formError: string | null;
  saving: boolean;
  waiting: boolean;
  toast: string | null;
  preset: Preset;
  customFrom: string;
  customTo: string;
  slices: Slice[];
  reportEmpty: boolean;
  reportError: string | null;
};

export function mount(root: HTMLElement, deps: { initData: string; fetch: typeof fetch }): void {
  const state: State = {
    tab: "home",
    step: "home",
    balance: null,
    category: null,
    expenseAmount: "",
    expenseComment: "",
    depositAmount: "",
    depositComment: "",
    formError: null,
    saving: false,
    waiting: false,
    toast: null,
    preset: "month",
    customFrom: "",
    customTo: "",
    slices: [],
    reportEmpty: true,
    reportError: null,
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const node = target.closest("[data-action]");
    if (!node) return;
    const action = node.getAttribute("data-action");
    if (!action) return;
    onAction(action);
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.id === "expense-amount") state.expenseAmount = target.value;
    if (target.id === "expense-comment") state.expenseComment = target.value;
    if (target.id === "deposit-amount") state.depositAmount = target.value;
    if (target.id === "deposit-comment") state.depositComment = target.value;
    if (target.id === "report-from") state.customFrom = target.value;
    if (target.id === "report-to") state.customTo = target.value;
    render();
    if ((target.id === "report-from" || target.id === "report-to") && state.customFrom && state.customTo) {
      void loadReport();
    }
  });

  let reportToken = 0;

  render();
  void loadBalance();
  void loadReport();

  function onAction(action: string): void {
    if (action === "tab-home") {
      state.tab = "home";
      state.toast = null;
      render();
      return;
    }
    if (action === "tab-reports") {
      state.tab = "reports";
      state.toast = null;
      render();
      return;
    }
    if (action === "add") {
      state.step = "type";
      state.formError = null;
      render();
      return;
    }
    if (action === "expense") {
      state.step = "categories";
      state.formError = null;
      render();
      return;
    }
    if (action === "deposit") {
      state.step = "deposit";
      state.formError = null;
      render();
      return;
    }
    if (action === "type-back") {
      state.step = "home";
      state.formError = null;
      render();
      return;
    }
    if (action === "categories-back" || action === "deposit-cancel") {
      state.step = "type";
      state.formError = null;
      render();
      return;
    }
    if (action === "expense-cancel") {
      state.step = "categories";
      state.formError = null;
      render();
      return;
    }
    if (action.startsWith("category-")) {
      state.category = action.slice("category-".length);
      state.step = "amount";
      state.formError = null;
      render();
      return;
    }
    if (action === "expense-submit") {
      void submit("expense");
      return;
    }
    if (action === "deposit-submit") {
      void submit("deposit");
      return;
    }
    if (action === "preset-month" || action === "preset-quarter" || action === "preset-year") {
      state.preset = action.slice("preset-".length) as Preset;
      state.customFrom = "";
      state.customTo = "";
      state.toast = null;
      void loadReport();
      return;
    }
    if (action === "report-pie") {
      state.toast = null;
      render();
      return;
    }
    if (action.startsWith("stub-")) {
      state.toast = "В разработке";
      render();
    }
  }

  async function submit(kind: "expense" | "deposit"): Promise<void> {
    if (state.saving) return;
    const amount = normalizeAmount(kind === "expense" ? state.expenseAmount : state.depositAmount);
    if (!amountOk(amount)) {
      state.formError = "Введите сумму больше 0";
      render();
      return;
    }
    if (kind === "expense" && !state.category) {
      state.formError = "Выберите категорию";
      render();
      return;
    }
    state.saving = true;
    state.waiting = false;
    state.formError = null;
    render();
    const timer = setTimeout(() => {
      state.waiting = true;
      render();
    }, 3000);
    try {
      const response = await deps.fetch("/api/transactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `tma ${deps.initData}`,
        },
        body: JSON.stringify(
          kind === "expense"
            ? {
                type: "expense",
                amount,
                category: state.category,
                comment: state.expenseComment.trim(),
              }
            : { type: "deposit", amount, comment: state.depositComment.trim() },
        ),
      });
      const payload = (await response.json()) as { balance?: string; error?: string };
      if (!response.ok || !payload.balance) {
        state.formError = payload.error ?? "Не удалось сохранить, попробуйте ещё раз";
        return;
      }
      state.balance = payload.balance;
      state.step = "home";
      state.tab = "home";
      state.expenseAmount = "";
      state.expenseComment = "";
      state.depositAmount = "";
      state.depositComment = "";
      state.formError = null;
    } catch {
      state.formError = "Не удалось сохранить, попробуйте ещё раз";
    } finally {
      clearTimeout(timer);
      state.saving = false;
      state.waiting = false;
      render();
    }
  }

  async function loadBalance(): Promise<void> {
    try {
      const response = await deps.fetch("/api/balance", { headers: authHeader() });
      if (!response.ok) return;
      const payload = (await response.json()) as { balance: string };
      state.balance = payload.balance;
      render();
    } catch {
      /* Home stays on the placeholder until a later successful read. */
    }
  }

  async function loadReport(): Promise<void> {
    const token = ++reportToken;
    const query =
      state.customFrom && state.customTo
        ? `from=${encodeURIComponent(state.customFrom)}&to=${encodeURIComponent(state.customTo)}`
        : `preset=${state.preset}`;
    try {
      const response = await deps.fetch(`/api/report?${query}`, { headers: authHeader() });
      const payload = (await response.json()) as { slices?: Slice[]; empty?: boolean; error?: string };
      if (token !== reportToken) return;
      if (!response.ok) {
        state.reportError = payload.error ?? "Неверный период";
        render();
        return;
      }
      state.slices = payload.slices ?? [];
      state.reportEmpty = payload.empty ?? state.slices.length === 0;
      state.reportError = null;
      render();
    } catch {
      if (token !== reportToken) return;
      state.reportError = "Неверный период";
      render();
    }
  }

  function authHeader(): HeadersInit {
    return { authorization: `tma ${deps.initData}` };
  }

  function render(): void {
    const active = document.activeElement;
    const activeId = active instanceof HTMLElement ? active.id : "";
    const caret = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null;
    root.innerHTML = view(state);
    if (!activeId) return;
    const next = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${CSS.escape(activeId)}`);
    if (!next) return;
    next.focus();
    if (caret !== null) next.setSelectionRange(caret, caret);
  }
}

function view(state: State): string {
  return `<div class="app">${header(state)}${state.tab === "home" ? home(state) : reports(state)}</div>`;
}

function header(state: State): string {
  const balance = state.balance ?? "…";
  return `<header class="top">
    <p class="balance">${esc(balance)} €</p>
    <nav class="tabs">
      <button type="button" data-action="tab-home" aria-current="${state.tab === "home" ? "page" : "false"}">Home</button>
      <button type="button" data-action="tab-reports" aria-current="${state.tab === "reports" ? "page" : "false"}">Reports</button>
    </nav>
  </header>`;
}

function home(state: State): string {
  if (state.step === "home") {
    return `<button type="button" class="add" data-action="add">Добавить</button>`;
  }
  if (state.step === "type") {
    return `<section class="stack" role="dialog" aria-label="Тип">
      <button type="button" class="blue" data-action="expense">Расходы</button>
      <button type="button" class="green" data-action="deposit">Депозит</button>
      <button type="button" class="neutral" data-action="type-back">Назад</button>
    </section>`;
  }
  if (state.step === "categories") {
    const buttons = EXPENSE_CATEGORIES.map(
      (category) =>
        `<button type="button" class="neutral" data-action="category-${esc(category)}">${esc(category)}</button>`,
    ).join("");
    return `<section class="stack"><h1>Категория</h1>${buttons}<button type="button" class="neutral" data-action="categories-back">Назад</button></section>`;
  }
  if (state.step === "amount") {
    return `<form class="stack" onsubmit="return false">
      <h1>${esc(state.category ?? "")}</h1>
      <label for="expense-amount">Сумма</label>
      <input id="expense-amount" inputmode="decimal" autocomplete="off" value="${esc(state.expenseAmount)}" />
      <label for="expense-comment">Комментарий</label>
      <textarea id="expense-comment" maxlength="200">${esc(state.expenseComment)}</textarea>
      ${errorLine(state.formError)}
      <button type="button" class="red" data-action="expense-cancel">Отменить</button>
      <button type="button" class="green" data-action="expense-submit" ${state.saving ? "disabled" : ""}>${state.waiting ? "Сохранение…" : "Отправить"}</button>
    </form>`;
  }
  const depositDisabled = state.saving || !amountOk(normalizeAmount(state.depositAmount));
  return `<form class="stack" onsubmit="return false">
    <h1>Депозит</h1>
    <label for="deposit-amount">Сумма</label>
    <input id="deposit-amount" inputmode="decimal" autocomplete="off" value="${esc(state.depositAmount)}" />
    <label for="deposit-comment">Комментарий</label>
    <textarea id="deposit-comment" maxlength="200">${esc(state.depositComment)}</textarea>
    ${errorLine(state.formError)}
    <button type="button" class="red" data-action="deposit-cancel">Отменить</button>
    <button type="button" class="green" data-action="deposit-submit" ${depositDisabled ? "disabled" : ""}>${state.waiting ? "Сохранение…" : "ДЕПС"}</button>
  </form>`;
}

function reports(state: State): string {
  const pie = state.reportEmpty ? `<p class="empty">Нет расходов за период</p>` : `${pieMarkup(state.slices)}<ul class="legend">${state.slices
    .map((slice) => `<li>${esc(slice.category)} ${esc(slice.amount)} €</li>`)
    .join("")}</ul>`;
  return `<section class="stack">
    <button type="button" class="neutral" data-action="report-pie">Категории</button>
    <button type="button" class="stub" data-action="stub-months">По месяцам</button>
    <button type="button" class="stub" data-action="stub-authors">По авторам</button>
    <button type="button" class="stub" data-action="stub-list">Список</button>
    <div class="presets">
      <button type="button" data-action="preset-month" aria-pressed="${state.preset === "month" && !state.customFrom}">Месяц</button>
      <button type="button" data-action="preset-quarter" aria-pressed="${state.preset === "quarter" && !state.customFrom}">3 месяца</button>
      <button type="button" data-action="preset-year" aria-pressed="${state.preset === "year" && !state.customFrom}">Год</button>
    </div>
    <label for="report-from">С</label>
    <input id="report-from" type="date" value="${esc(state.customFrom)}" />
    <label for="report-to">По</label>
    <input id="report-to" type="date" value="${esc(state.customTo)}" />
    ${errorLine(state.reportError)}
    ${state.toast ? `<p class="toast" role="status">${esc(state.toast)}</p>` : ""}
    ${pie}
  </section>`;
}

function errorLine(message: string | null): string {
  return message ? `<p class="error" role="alert">${esc(message)}</p>` : "";
}

function normalizeAmount(raw: string): string {
  const trimmed = raw.trim();
  const commas = trimmed.match(/,/g)?.length ?? 0;
  if (commas === 1 && !trimmed.includes(".")) return trimmed.replace(",", ".");
  return trimmed;
}

function amountOk(amount: string): boolean {
  try {
    parseAmount(amount);
    return true;
  } catch {
    return false;
  }
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
