import type { Hono } from "hono";
import { parseAllowedUserIds } from "./allowedUserIds.js";
import { createApp } from "./http/app.js";
import { createGoogleJournal } from "./sheets/google.js";
import { WriteQueue } from "./sheets/queue.js";
import type { JournalStore } from "./sheets/types.js";

export function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function sheetsCredentials(): string {
  return process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || mustEnv("GOOGLE_APPLICATION_CREDENTIALS");
}

export async function createRuntime(options: { staticDir?: string } = {}): Promise<{
  app: Hono;
  botToken: string;
  store: JournalStore;
  allowedUserIds: ReadonlySet<number>;
}> {
  const botToken = mustEnv("BOT_TOKEN");
  const allowedUserIds = parseAllowedUserIds();
  const store = await createGoogleJournal(mustEnv("SHEET_ID"), sheetsCredentials());
  const app = createApp({
    botToken,
    queue: new WriteQueue(store, () => new Date()),
    store,
    now: () => new Date(),
    staticDir: options.staticDir,
    allowedUserIds,
  });
  return { app, botToken, store, allowedUserIds };
}
