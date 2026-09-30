import type { DateRange, Ymd } from "./types.js";

const BERLIN = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "longOffset",
});

type BerlinParts = {
  ymd: Ymd;
  hour: string;
  minute: string;
  second: string;
  offset: string;
};

export function berlinParts(instant: Date): BerlinParts {
  const parts = BERLIN.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  let hour = read("hour");
  if (hour === "24") hour = "00";
  return {
    ymd: { year: Number(read("year")), month: Number(read("month")), day: Number(read("day")) },
    hour,
    minute: read("minute"),
    second: read("second"),
    offset: read("timeZoneName").replace("GMT", ""),
  };
}

export function berlinYmd(instant: Date): Ymd {
  return berlinParts(instant).ymd;
}

export function formatIsoBerlin(instant: Date): string {
  const parts = berlinParts(instant);
  return `${ymdKey(parts.ymd)}T${parts.hour}:${parts.minute}:${parts.second}${parts.offset}`;
}

export function ymdKey(value: Ymd): string {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

export function compareYmd(left: Ymd, right: Ymd): number {
  return ymdKey(left).localeCompare(ymdKey(right));
}

export function parseIsoToYmd(iso: string): Ymd | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly?.[1] && dateOnly[2] && dateOnly[3]) {
    return { year: Number(dateOnly[1]), month: Number(dateOnly[2]), day: Number(dateOnly[3]) };
  }
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return berlinYmd(new Date(time));
}

export function presetRange(preset: "month" | "quarter" | "year", now: Date): DateRange {
  const today = berlinYmd(now);
  if (preset === "year") {
    return { from: { year: today.year, month: 1, day: 1 }, to: { year: today.year, month: 12, day: 31 } };
  }
  const to = { year: today.year, month: today.month, day: lastDay(today.year, today.month) };
  if (preset === "month") return { from: { year: today.year, month: today.month, day: 1 }, to };
  const start = addMonths(today.year, today.month, -2);
  return { from: { year: start.year, month: start.month, day: 1 }, to };
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
