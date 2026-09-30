import type { Hono } from "hono";
import { Bot } from "grammy";

export async function startBot(token: string, app: Hono, webhookUrl: string): Promise<void> {
  const bot = new Bot(token);
  const me = await bot.api.getMe();
  if (!me.username) throw new Error("Bot has no username");
  const link = `https://t.me/${me.username}?startapp`;
  bot.command("start", async (ctx) => {
    await ctx.reply(`Семейный бюджет\n${link}`);
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
