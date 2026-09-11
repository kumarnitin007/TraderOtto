export type MarketSessionKind =
  | "closed"
  | "extended"
  | "warmup"
  | "regular"
  | "cooldown";

export type AlpacaClockPayload = {
  timestamp?: string;
  is_open?: boolean;
  next_open?: string;
  next_close?: string;
};

export type MarketSchedule = {
  session: MarketSessionKind;
  source: "alpaca" | "local";
  isOpen: boolean;
  nextOpen: string | null;
  nextClose: string | null;
  stockIntervalMs: number;
  optionIntervalMs: number;
  pollStocks: boolean;
  pollOptions: boolean;
  asOfClose: boolean;
  delayed: boolean;
  clockAt: string;
};

export const STOCK_LIVE_MS = 30_000;
export const STOCK_WARMUP_MS = 15_000;
export const STOCK_EXTENDED_MS = 60_000;
export const OPTION_LIVE_MS = 30_000;
export const OPTION_WARMUP_MS = 15_000;

const EASTERN = "America/New_York";
const PREOPEN = 4 * 60;
const WARMUP = 9 * 60 + 15;
const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const COOLDOWN_END = 16 * 60 + 15;
const EXTENDED_END = 20 * 60;
const WARMUP_MS = 15 * 60 * 1000;

const NYSE_HOLIDAYS = new Set([
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

export type EasternParts = {
  weekday: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  ymd: string;
  minutes: number;
};

export function easternParts(now: Date): EasternParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = Number(pick("year"));
  const month = Number(pick("month"));
  const day = Number(pick("day"));
  const hour = Number(pick("hour"));
  const minute = Number(pick("minute"));
  return {
    weekday: pick("weekday"),
    year,
    month,
    day,
    hour,
    minute,
    ymd: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
  };
}

export function sessionFromMinutes(minutes: number, isTradingDay: boolean): MarketSessionKind {
  if (!isTradingDay) return "closed";
  if (minutes < PREOPEN || minutes >= EXTENDED_END) return "closed";
  if (minutes < WARMUP) return "extended";
  if (minutes < OPEN) return "warmup";
  if (minutes < CLOSE) return "regular";
  if (minutes < COOLDOWN_END) return "cooldown";
  return "extended";
}

export function isLocalTradingDay(parts: EasternParts) {
  return parts.weekday !== "Sat" && parts.weekday !== "Sun" && !NYSE_HOLIDAYS.has(parts.ymd);
}

function easternOffsetMinutes(date: Date) {
  const tz =
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN,
      timeZoneName: "shortOffset",
      hour: "numeric",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = tz.match(/GMT([+-]\d+)(?::(\d+))?/i);
  const hours = Number(match?.[1] ?? -5);
  const minutes = Number(match?.[2] ?? 0);
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

export function easternWallToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = easternOffsetMinutes(new Date(asUtc));
  return new Date(asUtc - offset * 60_000).toISOString();
}

function addCalendarDays(parts: EasternParts, days: number) {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  return easternParts(new Date(utc + 12 * 60 * 60 * 1000));
}

function nextTradingDay(parts: EasternParts, fromToday: boolean) {
  let next = fromToday ? parts : addCalendarDays(parts, 1);
  while (!isLocalTradingDay(next)) next = addCalendarDays(next, 1);
  return next;
}

function localNextOpenClose(parts: EasternParts) {
  const openDay =
    isLocalTradingDay(parts) && parts.minutes < OPEN ? parts : nextTradingDay(parts, false);
  const closeDay =
    isLocalTradingDay(parts) && parts.minutes < CLOSE ? parts : nextTradingDay(parts, false);
  return {
    nextOpen: easternWallToIso(openDay.year, openDay.month, openDay.day, 9, 30),
    nextClose: easternWallToIso(closeDay.year, closeDay.month, closeDay.day, 16, 0),
  };
}

function ymdFromIso(value?: string | null) {
  if (!value) return null;
  return easternParts(new Date(value)).ymd;
}

function decorate(
  session: MarketSessionKind,
  source: "alpaca" | "local",
  nextOpen: string | null,
  nextClose: string | null,
  now: Date
): MarketSchedule {
  const pollStocks = session !== "closed";
  const pollOptions = session === "warmup" || session === "regular" || session === "cooldown";
  const stockIntervalMs =
    session === "warmup"
      ? STOCK_WARMUP_MS
      : session === "extended"
        ? STOCK_EXTENDED_MS
        : pollStocks
          ? STOCK_LIVE_MS
          : 0;
  const optionIntervalMs =
    session === "warmup" ? OPTION_WARMUP_MS : pollOptions ? OPTION_LIVE_MS : 0;
  return {
    session,
    source,
    isOpen: session === "regular",
    nextOpen,
    nextClose,
    stockIntervalMs,
    optionIntervalMs,
    pollStocks,
    pollOptions,
    asOfClose: session === "closed",
    delayed: session === "extended",
    clockAt: now.toISOString(),
  };
}

export function resolveSchedule(now: Date, alpaca?: AlpacaClockPayload | null): MarketSchedule {
  const parts = easternParts(now);
  const localTrading = isLocalTradingDay(parts);
  const localTimes = localNextOpenClose(parts);

  if (!alpaca || typeof alpaca.is_open !== "boolean") {
    return decorate(
      sessionFromMinutes(parts.minutes, localTrading),
      "local",
      localTimes.nextOpen,
      localTimes.nextClose,
      now
    );
  }

  const nextOpen = alpaca.next_open ?? localTimes.nextOpen;
  const nextClose = alpaca.next_close ?? localTimes.nextClose;
  const opensToday = ymdFromIso(alpaca.next_open) === parts.ymd;
  const msUntilOpen = alpaca.next_open
    ? new Date(alpaca.next_open).getTime() - now.getTime()
    : Number.POSITIVE_INFINITY;
  const warmingUp = !alpaca.is_open && msUntilOpen > 0 && msUntilOpen <= WARMUP_MS;

  let isTradingDay = localTrading;
  if (alpaca.is_open || opensToday || warmingUp) {
    isTradingDay = true;
  } else if (localTrading && parts.minutes >= CLOSE && parts.minutes < EXTENDED_END) {
    isTradingDay = msUntilOpen < 5 * 24 * 60 * 60 * 1000;
  } else if (!localTrading) {
    isTradingDay = false;
  } else {
    isTradingDay = false;
  }

  let session = sessionFromMinutes(parts.minutes, isTradingDay);
  if (warmingUp) session = "warmup";
  if (alpaca.is_open) session = "regular";
  else if (session === "regular") {
    session = warmingUp ? "warmup" : "closed";
  }

  return decorate(session, "alpaca", nextOpen, nextClose, now);
}

export function clockRefreshMs(schedule: MarketSchedule, now = Date.now()) {
  if (schedule.session !== "closed") return 60_000;
  if (!schedule.nextOpen) return 5 * 60_000;
  const untilWarmup = new Date(schedule.nextOpen).getTime() - now - WARMUP_MS;
  if (untilWarmup <= 0) return 15_000;
  return Math.max(30_000, Math.min(untilWarmup, 5 * 60_000));
}

export function connectionCheckMs(schedule: MarketSchedule) {
  if (schedule.session === "regular" || schedule.session === "warmup" || schedule.session === "cooldown") {
    return 60_000;
  }
  if (schedule.session === "extended") return 2 * 60_000;
  return 5 * 60_000;
}
