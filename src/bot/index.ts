import type { Hono } from "hono";
import { Bot } from "grammy";
import { startReply } from "./startReply.js";

export async function startBot(
  token: string,
  app: Hono,
  webhookUrl: string,
  allowedUserIds: ReadonlySet<number>,
): Promise<void> {
  const bot = new Bot(token);
  const me = await bot.api.getMe();
  if (!me.username) throw new Error("Bot has no username");
  const link = `https://t.me/${me.username}?startapp`;
  bot.command("start", async (ctx) => {
    const text = startReply(ctx.from?.id, allowedUserIds, link);
    if (text === undefined) return;
    await ctx.reply(text);
  });
  if (webhookUrl) {
    app.post("/telegram/webhook", async (c) => {
      await bot.handleUpdate(await c.req.json());
      return c.body(null, 200);
    });
    await bot.api.setWebhook(webhookUrl);
    return;
  }
  void bot.start();
}
