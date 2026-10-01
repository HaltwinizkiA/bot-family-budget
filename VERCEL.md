# Host Family Budget on Vercel

Repo: https://github.com/HaltwinizkiA/bot-family-budget

Vercel is serverless. That means:

- Telegram must use a **webhook**, not `bot.start()` polling.
- The service-account key must live in an **env var**, not a file on disk.
- The in-process write queue (CON-01) only serializes writes inside one warm isolate. Two overlapping Vercel invocations can still race. For two family members this is rare; it is not the same guarantee as one always-on process.

## 1. Google

1. Create a service account, download JSON.
2. Enable Google Sheets API on that Cloud project.
3. Share Family budget with the service account `client_email` as Editor.
4. Keep the JSON locally. You will paste it into Vercel as one line.

## 2. Files that must be in the repo

If they are not on `master` yet, copy from this machine after pull, or add them yourself:

- `api/index.ts` — Vercel Node function
- `src/runtime.ts` — shared boot
- `vercel.json` — static Mini App + rewrite `/api/*`
- `GOOGLE_SERVICE_ACCOUNT_JSON` support in `src/sheets/google.ts`

## 3. Import project

1. https://vercel.com/new
2. Import `HaltwinizkiA/bot-family-budget`
3. Framework: Other
4. Build command: `npm run build`
5. Output directory: `web/dist`
6. Node.js version: **22.x** (Project Settings → General)

Do not add a file env for the JSON key.

## 4. Environment variables (Production + Preview)

| Name | Value |
|---|---|
| `BOT_TOKEN` | token from BotFather |
| `SHEET_ID` | `1QXnOPAK5kwCW1ysHsWBrrOXK0QmODQOtyRPH18OLhqA` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | full JSON of the service account, one line |
| `WEBHOOK_URL` | `https://YOUR-PROJECT.vercel.app/api/telegram/webhook` |
| `PUBLIC_URL` | `https://YOUR-PROJECT.vercel.app` |

How to paste JSON: open the file, copy everything including `{` `}`, put it in the Vercel value field. No extra quotes around it.

Deploy once. Then set `WEBHOOK_URL` / `PUBLIC_URL` to the real `*.vercel.app` domain and **redeploy**.

## 5. BotFather

1. `/mybots` → bot → Bot Settings → Menu Button / Mini App
2. URL = `https://YOUR-PROJECT.vercel.app` (site root, not `/api`)
3. Optional check:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

`url` must be `https://YOUR-PROJECT.vercel.app/api/telegram/webhook`.

If empty:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook?url=https://YOUR-PROJECT.vercel.app/api/telegram/webhook"
```

## 6. Open it

Add the bot to the family group. Send `/start`. Open `https://t.me/<bot>?startapp` **inside Telegram**.

Home should show `300.00` from B1. A €1 grocery write should appear in the sheet.

## 7. Local vs Vercel

Local stays two processes (`npm run dev` + `npm run dev:web`) and a key file.

Vercel uses only `GOOGLE_SERVICE_ACCOUNT_JSON` and the webhook.

## Failures

| Symptom | Cause |
|---|---|
| Build ok, function 500 `Missing BOT_TOKEN` | env not set for Production |
| `The caller does not have permission` | sheet not shared with `client_email` |
| `/start` does nothing | webhook URL wrong or still polling locally with the same token |
| Mini App opens blank / 401 on save | opened in an external browser, not Telegram |
| Two writes, same ID | two serverless isolates; retry. Not fixed by Vercel Hobby |
