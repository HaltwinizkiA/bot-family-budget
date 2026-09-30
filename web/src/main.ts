import { mount } from "./app.ts";

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) throw new Error("missing #app");

const webApp = window.Telegram?.WebApp;
webApp?.ready();
webApp?.expand();

mount(root, {
  initData: webApp?.initData ?? "",
  fetch: window.fetch.bind(window),
});
