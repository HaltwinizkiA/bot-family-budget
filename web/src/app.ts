import { EXPENSE_CATEGORIES } from "@domain/categories.ts";
import { parseAmount } from "@domain/money.ts";
import { pieMarkup } from "./pie.ts";

type Slice = { category: string; amount: string };
type Step = "home" | "categories" | "amount" | "deposit";
type Tab = "home" | "reports";
type Preset = "month" | "quarter" | "year";

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  Rent: "Аренда",
  Groceries: "Продукты",
  Household: "Быт",
  Gifts: "Подарки",
  "Restaurants & Cafés": "Рестораны и кафе",
  Transport: "Транспорт",
  Entertainment: "Развлечения",
  Miscellaneous: "Прочее",
  income: "Доход",
};

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

  root.addEventListener("focusin", (event) => {
    const target = event.target;
    if (restoringFocus) return;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (typeof target.scrollIntoView !== "function") return;
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  let reportToken = 0;
  let presented = "";
  let restoringFocus = false;

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
    if (action === "categories-back" || action === "deposit-cancel" || action === "expense-cancel") {
      state.step = "home";
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
    const key = `${state.tab}:${state.step}`;
    const enter = key !== presented;
    presented = key;
    const active = document.activeElement;
    const activeId = active instanceof HTMLElement && root.contains(active) ? active.id : "";
    const caret = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null;
    root.innerHTML = view(state, enter);
    if (!activeId) return;
    const next = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${CSS.escape(activeId)}`);
    if (!next) return;
    restoringFocus = true;
    try {
      next.focus();
      if (caret !== null) next.setSelectionRange(caret, caret);
    } finally {
      restoringFocus = false;
    }
  }
}

function view(state: State, enter: boolean): string {
  return `<div class="app">${header(state)}${state.tab === "home" ? home(state, enter) : reports(state, enter)}</div>`;
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

function home(state: State, enter: boolean): string {
  if (state.step === "categories") {
    const buttons = EXPENSE_CATEGORIES.map(
      (category) =>
        `<button type="button" class="neutral" data-action="category-${esc(category)}">${esc(categoryLabel(category))}</button>`,
    ).join("");
    return `<section class="${stackClass(enter, false)}"><h1>Категория</h1>${buttons}<button type="button" class="neutral" data-action="categories-back">Отменить</button></section>`;
  }
  if (state.step === "amount") {
    const invalid = state.formError ? `aria-invalid="true" aria-describedby="form-error"` : "";
    return `<form class="${stackClass(enter, true)}" onsubmit="return false">
      <h1>${esc(categoryLabel(state.category ?? ""))}</h1>
      <label for="expense-amount">Сумма</label>
      <input id="expense-amount" inputmode="decimal" autocomplete="off" value="${esc(state.expenseAmount)}" ${invalid} />
      <label for="expense-comment">Комментарий</label>
      <textarea id="expense-comment" maxlength="200">${esc(state.expenseComment)}</textarea>
      ${errorLine(state.formError, "form-error")}
      <button type="button" class="expense" data-action="expense-submit" ${state.saving ? "disabled" : ""}>${state.waiting ? "Сохранение…" : "Отправить"}</button>
      <button type="button" class="neutral" data-action="expense-cancel">Отменить</button>
    </form>`;
  }
  if (state.step === "deposit") {
    const depositDisabled = state.saving || !amountOk(normalizeAmount(state.depositAmount));
    const invalid = state.formError ? `aria-invalid="true" aria-describedby="form-error"` : "";
    return `<form class="${stackClass(enter, true)}" onsubmit="return false">
      <h1>Депозит</h1>
      <label for="deposit-amount">Сумма</label>
      <input id="deposit-amount" inputmode="decimal" autocomplete="off" value="${esc(state.depositAmount)}" ${invalid} />
      <label for="deposit-comment">Комментарий</label>
      <textarea id="deposit-comment" maxlength="200">${esc(state.depositComment)}</textarea>
      ${errorLine(state.formError, "form-error")}
      <button type="button" class="deposit" data-action="deposit-submit" ${depositDisabled ? "disabled" : ""}>${state.waiting ? "Сохранение…" : "ДЕПС"}</button>
      <button type="button" class="neutral" data-action="deposit-cancel">Отменить</button>
    </form>`;
  }
  return `<section class="${stackClass(enter, false)} actions" aria-label="Операция">
    <button type="button" class="expense" data-action="expense">Расходы</button>
    <button type="button" class="deposit" data-action="deposit">Депозит</button>
  </section>`;
}

function reports(state: State, enter: boolean): string {
  const pie = state.reportEmpty ? `<p class="empty">Нет расходов за период</p>` : `${pieMarkup(state.slices)}<ul class="legend">${state.slices
    .map((slice) => `<li>${esc(categoryLabel(slice.category))} ${esc(slice.amount)} €</li>`)
    .join("")}</ul>`;
  return `<section class="${stackClass(enter, true)}">
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

function stackClass(enter: boolean, still: boolean): string {
  if (!enter) return "stack";
  return still ? "stack screen-enter screen-still" : "stack screen-enter";
}

function errorLine(message: string | null, id = ""): string {
  if (!message) return "";
  const attr = id ? ` id="${id}"` : "";
  return `<p class="error" role="alert"${attr}>${esc(message)}</p>`;
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
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
