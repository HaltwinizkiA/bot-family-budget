import crypto from "node:crypto";
import { AuthError } from "../domain/errors.js";

const MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifyInitData(
  initData: string,
  botToken: string,
  now: Date,
): { id: number; username?: string } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new AuthError();
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const left = Buffer.from(calculated, "hex");
  const right = Buffer.from(hash, "hex");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw new AuthError();

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) throw new AuthError();
  if (Math.floor(now.getTime() / 1000) - authDate > MAX_AGE_SECONDS) throw new AuthError();

  const userRaw = params.get("user");
  if (!userRaw) throw new AuthError();
  let user: { id?: unknown; username?: unknown };
  try {
    user = JSON.parse(userRaw) as { id?: unknown; username?: unknown };
  } catch {
    throw new AuthError();
  }
  if (typeof user.id !== "number") throw new AuthError();
  const parsed: { id: number; username?: string } = { id: user.id };
  if (typeof user.username === "string" && user.username.length > 0) parsed.username = user.username;
  return parsed;
}
