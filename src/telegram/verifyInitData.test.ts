import { describe, expect, it } from "vitest";
import { verifyInitData } from "./verifyInitData.js";
import { AuthError } from "../domain/errors.js";
import { signInitData } from "../test/signInitData.js";

const TOKEN = "123456:TEST";
const NOW = new Date("2026-10-01T12:00:00Z");
const AUTH = String(Math.floor(NOW.getTime() / 1000) - 60);

function payload(user: object, extra: Record<string, string> = {}): string {
  return signInitData(TOKEN, { auth_date: AUTH, user: JSON.stringify(user), ...extra });
}

describe("verifyInitData", () => {
  it("returns the user from a valid hash", () => {
    const parsed = verifyInitData(payload({ id: 7, username: "anna" }), TOKEN, NOW);
    expect(parsed).toEqual({ id: 7, username: "anna" });
  });

  it("rejects a forged hash, a missing hash, and a missing user", () => {
    const forged = signInitData(TOKEN, { auth_date: AUTH, user: JSON.stringify({ id: 7, username: "anna" }) }, "00");
    expect(() => verifyInitData(forged, TOKEN, NOW)).toThrow(AuthError);
    expect(() => verifyInitData("auth_date=1&user=%7B%7D", TOKEN, NOW)).toThrow(AuthError);
    expect(() => verifyInitData(signInitData(TOKEN, { auth_date: AUTH }), TOKEN, NOW)).toThrow(AuthError);
  });

  it("rejects initData older than 24 hours", () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 86401);
    const initData = signInitData(TOKEN, { auth_date: old, user: JSON.stringify({ id: 7, username: "anna" }) });
    expect(() => verifyInitData(initData, TOKEN, NOW)).toThrow(AuthError);
  });

  it("keeps a user id when the username is absent", () => {
    const parsed = verifyInitData(payload({ id: 42 }), TOKEN, NOW);
    expect(parsed).toEqual({ id: 42 });
  });
});
