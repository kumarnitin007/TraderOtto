import { todayISO } from "@/lib/pnl";
import type { NotificationSignal } from "@/types/notification";

export function signalDay(firedAt: string) {
  return todayISO(new Date(firedAt));
}

export function firedToday(
  signals: NotificationSignal[],
  dedupeKey: string,
  now = new Date()
) {
  const day = todayISO(now);
  return signals.some(
    (signal) => signal.dedupeKey === dedupeKey && signalDay(signal.firedAt) === day
  );
}

export function dispatchedDayKey(dedupeKey: string, now = new Date()) {
  return `${dedupeKey}::${todayISO(now)}`;
}
