import type { BankCurrency } from "@/types/bank";

const KEY = "trader-otto:banks-preferences";

export type BanksPreferences = {
  home: BankCurrency;
  inrPerUsd: number | null;
};

const DEFAULTS: BanksPreferences = {
  home: "USD",
  inrPerUsd: null,
};

export function readBanksPreferences(): BanksPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<BanksPreferences>;
    const rate = Number(parsed.inrPerUsd);
    return {
      home: parsed.home === "INR" ? "INR" : "USD",
      inrPerUsd: Number.isFinite(rate) && rate > 0 ? rate : null,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeBanksPreferences(next: BanksPreferences) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
}
