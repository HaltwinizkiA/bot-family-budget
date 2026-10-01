import type { IncomingMessage, ServerResponse } from "node:http";
import { Bot } from "grammy";
import { handle } from "hono/vercel";
import { createRuntime } from "../src/runtime.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

type VercelHandler = (req: IncomingMessage, res: ServerResponse) => unknown;

let handlerPromise: Promise<VercelHandler> | undefined;

async function boot(): Promise<VercelHandler> {
  const { app, botToken } = await createRuntime();
  const bot = new Bot(botToken);
  const me = await bot.api.getMe();
  if (!me.username) throw new Error("Bot has no username");
  const startLink = `https://t.me/${me.username}?startapp`;
  bot.command("start", async (ctx) => {
    await ctx.reply(`Семейный бюджет\n${startLink}`);
  });
  app.post("/api/telegram/webhook", async (c) => {
    await bot.handleUpdate(await c.req.json());
    return c.body(null, 200);
  });
  const webhook = process.env.WEBHOOK_URL?.trim();
  if (webhook) await bot.api.setWebhook(webhook);
  return handle(app) as VercelHandler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  handlerPromise ??= boot();
  const impl = await handlerPromise;
  return impl(req, res);
}
