import { mount } from "./app.ts";

export async function enterApp(deps: {
  initData: string;
  fetch: typeof fetch;
  prepare?: () => void;
}): Promise<void> {
  const trimmed = deps.initData.trim();
  if (!trimmed) {
    showNotFound();
    return;
  }
  let response: Response;
  try {
    response = await deps.fetch("/api/balance", {
      headers: { authorization: `tma ${trimmed}` },
    });
  } catch {
    openHome(deps, trimmed);
    return;
  }
  if (response.status === 401) {
    showNotFound();
    return;
  }
  openHome(deps, trimmed);
}

function showNotFound(): void {
  document.title = "404";
  document.documentElement.lang = "en";
  const title = document.createElement("h1");
  title.id = "not-found-title";
  title.textContent = "404";
  const text = document.createElement("p");
  text.id = "not-found-text";
  text.textContent = "Not found";
  document.body.replaceChildren(title, text);
}

function openHome(deps: { fetch: typeof fetch; prepare?: () => void }, initData: string): void {
  document.title = "Family Budget";
  document.documentElement.lang = "ru";
  document.getElementById("not-found-title")?.remove();
  document.getElementById("not-found-text")?.remove();
  let root = document.getElementById("app");
  if (!(root instanceof HTMLElement)) {
    root = document.createElement("div");
    root.id = "app";
    document.body.append(root);
  }
  deps.prepare?.();
  mount(root, { initData, fetch: deps.fetch });
}
