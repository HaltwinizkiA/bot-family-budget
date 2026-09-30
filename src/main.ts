import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { startBot } from "./bot/index.js";
import { createApp } from "./http/app.js";
import { createGoogleJournal } from "./sheets/google.js";
import { WriteQueue } from "./sheets/queue.js";

function must(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const token = must("BOT_TOKEN");
const sheetId = must("SHEET_ID");
const credentials = must("GOOGLE_APPLICATION_CREDENTIALS");
const port = Number(process.env.PORT ?? "3000");
const webhookUrl = process.env.WEBHOOK_URL ?? "";
const staticDir = fileURLToPath(new URL("../web/dist", import.meta.url));

const store = await createGoogleJournal(sheetId, credentials);
const app = createApp({
  botToken: token,
  queue: new WriteQueue(store, () => new Date()),
  store,
  now: () => new Date(),
  staticDir: fs.existsSync(path.join(staticDir, "index.html")) ? staticDir : undefined,
});

await startBot(token, app, webhookUrl);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Family Budget listening on ${info.port}`);
});
