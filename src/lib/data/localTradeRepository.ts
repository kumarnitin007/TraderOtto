import type { ClosePayload, NewTrade, Trade } from "@/types/trade";
import type { TradeRepository } from "@/lib/data/tradeRepository";

const STORAGE_KEY = "trader-otto:trades";

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 11);
}

function readAll(): Trade[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Trade & { screenshotDataUrl?: string }>;
    // Drop the demo trades and any screenshots kept by earlier versions.
    const cleaned = parsed
      .filter((trade) => !trade.id.startsWith("seed-"))
      .map((trade) => {
        const copy = { ...trade };
        delete copy.screenshotDataUrl;
        return copy;
      });
    if (cleaned.length !== parsed.length || parsed.some((t) => Boolean(t.screenshotDataUrl))) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function writeAll(trades: Trade[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

export const localTradeRepository: TradeRepository = {
  async list() {
    return readAll();
  },
  async add(trade: NewTrade) {
    const now = nowIso();
    const next: Trade = {
      ...trade,
      id: uid(),
      status: "open",
      closeDate: null,
      stockPriceClose: null,
      premiumClose: null,
      createdAt: now,
      updatedAt: now,
    };
    const all = [next, ...readAll()];
    writeAll(all);
    return next;
  },
  async update(id: string, trade: NewTrade) {
    const all = readAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Trade not found");
    const updated: Trade = {
      ...all[idx],
      ...trade,
      id,
      updatedAt: nowIso(),
    };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },
  async close(id: string, closePayload: ClosePayload) {
    const all = readAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Trade not found");
    const updated: Trade = {
      ...all[idx],
      ...closePayload,
      status: "closed",
      updatedAt: nowIso(),
    };
    all[idx] = updated;
    writeAll(all);
    return updated;
  },
  async remove(id: string) {
    writeAll(readAll().filter((t) => t.id !== id));
  },
};
