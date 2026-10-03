import { enterApp } from "./gate.ts";

const webApp = window.Telegram?.WebApp;
webApp?.ready();
webApp?.expand();

void enterApp({
  initData: webApp?.initData ?? "",
  fetch: window.fetch.bind(window),
  prepare: () => {
    applyTelegramTheme(webApp);
    bindKeyboardInset();
    webApp?.onEvent?.("themeChanged", () => applyTelegramTheme(window.Telegram?.WebApp));
  },
});

function bindKeyboardInset(): void {
  let last = -1;
  const apply = () => {
    const viewport = window.visualViewport;
    const inset = viewport
      ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
      : 0;
    if (inset === last) return;
    last = inset;
    document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
  };
  apply();
  window.visualViewport?.addEventListener("resize", apply);
  window.visualViewport?.addEventListener("scroll", apply);
  window.addEventListener("resize", apply);
}

function applyTelegramTheme(webApp: TelegramWebApp | undefined): void {
  const scheme = webApp?.colorScheme;
  if (scheme === "dark" || scheme === "light") document.documentElement.dataset.theme = scheme;
  const params = webApp?.themeParams;
  setColor("--tg-bg", params?.bg_color);
  setColor("--tg-surface", params?.secondary_bg_color ?? params?.section_bg_color);
  setColor("--tg-text", params?.text_color);
  setColor("--tg-focus", params?.button_color);
  setColor("--tg-danger", params?.destructive_text_color);
}

function setColor(name: string, value: string | undefined): void {
  if (!value) return;
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return;
  document.documentElement.style.setProperty(name, trimmed);
}
