import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createdBy } from "../domain/author.js";
import { berlinYmd, parseIsoToYmd, presetRange, ymdKey } from "../domain/clock.js";
import { AuthError, InputError, InsufficientFundsError, SaveFailedError } from "../domain/errors.js";
import { formatEuros } from "../domain/money.js";
import { customRangeError, earliestYmd, expenseSlices } from "../domain/report.js";
import { parseTransaction } from "../domain/validate.js";
import type { WriteQueue } from "../sheets/queue.js";
import type { JournalStore } from "../sheets/types.js";
import { verifyInitData } from "../telegram/verifyInitData.js";

const BAD_PERIOD = "Неверный период";

export function createApp(deps: {
  botToken: string;
  queue: WriteQueue;
  store: JournalStore;
  now: () => Date;
  allowedUserIds: ReadonlySet<number>;
  staticDir?: string;
}): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof AuthError) return c.json({ error: error.message }, 401);
    if (error instanceof InsufficientFundsError) return c.json({ error: error.message }, 409);
    if (error instanceof InputError) return c.json({ error: error.message }, 400);
    if (error instanceof SaveFailedError) return c.json({ error: error.message }, 500);
    console.error(error);
    return c.json({ error: "Не удалось сохранить, попробуйте ещё раз" }, 500);
  });

  app.get("/api/balance", async (c) => {
    requireUser(c.req.header("authorization"), deps);
    const cents = await deps.store.readBalance();
    return c.json({ balance: formatEuros(cents) });
  });

  app.post("/api/transactions", async (c) => {
    const user = requireUser(c.req.header("authorization"), deps);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new InputError("Введите сумму больше 0");
    }
    const transaction = parseTransaction(body);
    const author = createdBy(user);
    const result = await deps.queue.post({ ...transaction, createdBy: author });
    return c.json(result);
  });

  app.get("/api/report", async (c) => {
    requireUser(c.req.header("authorization"), deps);
    const rows = await deps.store.readJournal();
    const earliest = earliestYmd(rows);
    const today = berlinYmd(deps.now());
    const preset = c.req.query("preset");
    const range =
      preset === "month" || preset === "quarter" || preset === "year"
        ? presetRange(preset, deps.now())
        : customRange(c.req.query("from"), c.req.query("to"), today, earliest);
    const slices = expenseSlices(rows, range);
    return c.json({
      slices,
      empty: slices.length === 0,
      earliest: earliest ? ymdKey(earliest) : null,
    });
  });

  app.get("/api/transactions", async (c) => {
    requireUser(c.req.header("authorization"), deps);
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number(limitRaw) : 0;
    const rows = await deps.store.readJournal();
    const sorted = [...rows].sort((a, b) => b.id - a.id);
    const selected = limit > 0 ? sorted.slice(0, limit) : sorted;
    return c.json({
      transactions: selected.map((row) => ({
        id: row.id,
        date: row.dateIso,
        amount: formatEuros(row.sumCents),
        category: row.category,
        comment: row.comment,
        createdBy: row.createdBy,
      })),
    });
  });

  app.delete("/api/transactions/:id", async (c) => {
    requireUser(c.req.header("authorization"), deps);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) throw new InputError("Запись не найдена");
    const result = await deps.queue.delete(id);
    return c.json(result);
  });

  if (deps.staticDir) {
    app.use("*", serveStatic({ root: deps.staticDir }));
  }

  return app;
}

function requireUser(
  header: string | undefined,
  deps: { botToken: string; now: () => Date; allowedUserIds: ReadonlySet<number> },
) {
  const match = /^tma\s+(.+)$/i.exec(header ?? "");
  if (!match?.[1]) throw new AuthError();
  const user = verifyInitData(match[1], deps.botToken, deps.now());
  if (!deps.allowedUserIds.has(user.id)) throw new AuthError();
  return user;
}

function customRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  today: ReturnType<typeof berlinYmd>,
  earliest: ReturnType<typeof earliestYmd>,
) {
  const from = fromRaw ? parseIsoToYmd(fromRaw) : null;
  const to = toRaw ? parseIsoToYmd(toRaw) : null;
  if (!from || !to) throw new InputError(BAD_PERIOD);
  const error = customRangeError(from, to, today, earliest);
  if (error) throw new InputError(error);
  return { from, to };
}
