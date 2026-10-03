import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { Bot } from "grammy";
import type { Hono } from "hono";
import { startReply } from "../src/bot/startReply.js";
import { createRuntime } from "../src/runtime.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

type Listener = (req: IncomingMessage, res: ServerResponse) => void;

let listenerPromise: Promise<Listener> | undefined;

async function boot(): Promise<Listener> {
  const { app, botToken, allowedUserIds } = await createRuntime();
  const bot = new Bot(botToken);
  const me = await bot.api.getMe();
  if (!me.username) throw new Error("Bot has no username");
  const startLink = `https://t.me/${me.username}?startapp`;
  bot.command("start", async (ctx) => {
    const text = startReply(ctx.from?.id, allowedUserIds, startLink);
    if (text === undefined) return;
    await ctx.reply(text);
  });
  app.post("/api/telegram/webhook", async (c) => {
    await bot.handleUpdate(await c.req.json());
    return c.body(null, 200);
  });
  const webhook = process.env.WEBHOOK_URL?.trim();
  if (webhook) await bot.api.setWebhook(webhook);
  return (req, res) => {
    void writeResponse(app, req, res);
  };
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  listenerPromise ??= boot();
  listenerPromise
      .then((listener) => listener(req, res))
      .catch((error: unknown) => {
        console.error(error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Не удалось сохранить, попробуйте ещё раз" }));
        }
      });
}

async function writeResponse(app: Hono, req: IncomingMessage, res: ServerResponse) {
  try {
    const response = await app.fetch(toRequest(req));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Не удалось сохранить, попробуйте ещё раз" }));
    }
  }
}

function toRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "localhost";
  const url = `https://${host}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else headers.set(key, value);
  }
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });
  return new Request(url, {
    method,
    headers,
    body: Readable.toWeb(req) as ReadableStream,
    duplex: "half",
  });
}