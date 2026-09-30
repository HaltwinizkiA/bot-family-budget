import { InputError } from "./errors.js";
import type { Cents } from "./types.js";

const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export function parseAmount(raw: string): Cents {
  const input = raw.trim();
  if (!AMOUNT.test(input)) throw new InputError("Введите сумму больше 0");
  const [whole = "0", fraction = ""] = input.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new InputError("Введите сумму больше 0");
  return cents;
}

export function formatEuros(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function eurosNumberToCents(value: number): Cents {
  if (!Number.isFinite(value)) throw new Error("B1 is not numeric");
  return Math.round(value * 100);
}
