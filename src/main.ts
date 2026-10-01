import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { startBot } from "./bot/index.js";
import { createRuntime } from "./runtime.js";

const port = Number(process.env.PORT ?? "3000");
const webhookUrl = process.env.WEBHOOK_URL ?? "";
const staticDir = fileURLToPath(new URL("../web/dist", import.meta.url));

const { app, botToken } = await createRuntime({
  staticDir: fs.existsSync(path.join(staticDir, "index.html")) ? staticDir : undefined,
});

await startBot(botToken, app, webhookUrl);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Family Budget listening on ${info.port}`);
});
