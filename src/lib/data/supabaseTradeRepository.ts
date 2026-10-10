import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClosedTradeImport,
  ClosePayload,
  NewTrade,
  Trade,
  TradeImport,
  TradeImportResult,
  TradeUpdate,
} from "@/types/trade";
import { realizedPnl } from "@/lib/pnl";
import {
  applyImportToTrade,
  isDuplicateClosedTrade,
  isDuplicateImportedTrade,
  matchTradesForImport,
  staleCloseCopies,
} from "@/lib/tradeDuplicate";

type TradeRow = {
  id: string;
  user_id: string;
  ticker: string;
  strategy: string;
  status: "open" | "closed";
  contracts: number;
  expiry: string;
  open_date: string;
  close_date: string | null;
  premium_open: number;
  premium_close: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function detailsFromTrade(trade: NewTrade, existing?: Record<string, unknown>) {
  return {
    ...existing,
    shortStrike: trade.shortStrike,
    longStrike: trade.longStrike,
    callShortStrike: trade.callShortStrike,
    callLongStrike: trade.callLongStrike,
    stockPriceOpen: trade.stockPriceOpen,
    iv: trade.iv,
    delta: trade.delta,
    sigma: trade.sigma,
    theta: trade.theta,
    commissionOpen: trade.commissionOpen ?? existing?.commissionOpen ?? 0,
    rolledFromTradeId:
      trade.rolledFromTradeId ?? existing?.rolledFromTradeId ?? null,
    importSource: trade.importSource ?? existing?.importSource ?? null,
    importFingerprint:
      trade.importFingerprint ?? existing?.importFingerprint ?? null,
    notes: trade.notes,
  };
}

function number(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === "number" ? value : 0;
}

function nullableNumber(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === "number" ? value : null;
}

function mapRow(row: TradeRow): Trade {
  const detail = row.details ?? {};
  return {
    id: row.id,
    userId: row.user_id,
    ticker: row.ticker,
    strategy: row.strategy,
    contracts: row.contracts,
    expiry: row.expiry,
    openDate: row.open_date,
    shortStrike: nullableNumber(detail, "shortStrike"),
    longStrike: nullableNumber(detail, "longStrike"),
    callShortStrike: nullableNumber(detail, "callShortStrike"),
    callLongStrike: nullableNumber(detail, "callLongStrike"),
    stockPriceOpen: number(detail, "stockPriceOpen"),
    iv: number(detail, "iv"),
    delta: number(detail, "delta"),
    sigma: number(detail, "sigma"),
    theta: number(detail, "theta"),
    premiumOpen: Number(row.premium_open),
    status: row.status,
    closeDate: row.close_date,
    stockPriceClose: nullableNumber(detail, "stockPriceClose"),
    premiumClose:
      row.premium_close == null ? null : Number(row.premium_close),
    commissionOpen: number(detail, "commissionOpen"),
    commissionClose: number(detail, "commissionClose"),
    closeReason:
      detail.closeReason === "expired" ||
      detail.closeReason === "assigned" ||
      detail.closeReason === "rolled"
        ? detail.closeReason
        : row.status === "closed" &&
            row.close_date != null &&
            row.close_date >= row.expiry &&
            Number(row.premium_close ?? 0) === 0
          ? "expired"
          : "closed",
    rolledFromTradeId:
      typeof detail.rolledFromTradeId === "string"
        ? detail.rolledFromTradeId
        : null,
    rolledToTradeId:
      typeof detail.rolledToTradeId === "string" ? detail.rolledToTradeId : null,
    importSource:
      typeof detail.importSource === "string" ? detail.importSource : null,
    importFingerprint:
      typeof detail.importFingerprint === "string"
        ? detail.importFingerprint
        : null,
    notes: typeof detail.notes === "string" ? detail.notes : "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireRow(data: unknown, error: { message: string } | null) {
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Supabase returned no trade.");
  return mapRow(data as TradeRow);
}

export function createSupabaseTradeRepository(
  supabase: SupabaseClient,
  userId: string
) {
  return {
    async list(): Promise<Trade[]> {
      const { data, error } = await supabase
        .from("tr_trades")
        .select("*")
        .is("deleted_at", null)
        .order("open_date", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as TradeRow[]).map(mapRow);
    },

    async add(trade: NewTrade): Promise<Trade> {
      const { data, error } = await supabase
        .from("tr_trades")
        .insert({
          user_id: userId,
          ticker: trade.ticker.toUpperCase(),
          strategy: trade.strategy,
          status: "open",
          contracts: trade.contracts,
          expiry: trade.expiry,
          open_date: trade.openDate,
          premium_open: trade.premiumOpen,
          details: detailsFromTrade(trade),
        })
        .select()
        .single();
      const created = requireRow(data, error);
      if (trade.rolledFromTradeId) {
        const { data: previous } = await supabase
          .from("tr_trades")
          .select("details")
          .eq("id", trade.rolledFromTradeId)
          .eq("user_id", userId)
          .maybeSingle();
        if (previous) {
          await supabase
            .from("tr_trades")
            .update({
              details: {
                ...((previous.details as Record<string, unknown> | null) ?? {}),
                rolledToTradeId: created.id,
              },
            })
            .eq("id", trade.rolledFromTradeId)
            .eq("user_id", userId);
        }
      }
      return created;
    },

    async addClosed(
      trade: ClosedTradeImport,
      allowDuplicate = false
    ): Promise<Trade> {
      const { data: matches, error: matchError } = await supabase
        .from("tr_trades")
        .select("*")
        .eq("user_id", userId)
        .eq("ticker", trade.ticker.toUpperCase())
        .eq("status", "closed")
        .eq("expiry", trade.expiry)
        .eq("close_date", trade.closeDate)
        .is("deleted_at", null);
      if (matchError) throw new Error(matchError.message);
      if (
        !allowDuplicate &&
        ((matches ?? []) as TradeRow[]).map(mapRow).some((item) =>
          isDuplicateClosedTrade(item, trade)
        )
      ) {
        throw new Error("This closed trade is already in your journal.");
      }

      const { data, error } = await supabase
        .from("tr_trades")
        .insert({
          user_id: userId,
          ticker: trade.ticker.toUpperCase(),
          strategy: trade.strategy,
          status: "closed",
          contracts: trade.contracts,
          expiry: trade.expiry,
          open_date: trade.openDate,
          close_date: trade.closeDate,
          premium_open: trade.premiumOpen,
          premium_close: trade.premiumClose,
          pnl: realizedPnl(
            trade.premiumOpen,
            trade.premiumClose,
            trade.contracts,
            trade.strategy,
            {
              commissionOpen: trade.commissionOpen,
              commissionClose: trade.commissionClose,
            }
          ),
          details: {
            ...detailsFromTrade(trade),
            stockPriceClose: trade.stockPriceClose,
            commissionClose: trade.commissionClose ?? 0,
            closeReason: trade.closeReason ?? "closed",
          },
        })
        .select()
        .single();
      return requireRow(data, error);
    },

    async importMany(items: TradeImport[]): Promise<TradeImportResult[]> {
      if (!items.length) return [];
      const { data: current, error: readError } = await supabase
        .from("tr_trades")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (readError) throw new Error(readError.message);
      const raw = (current ?? []) as TradeRow[];
      const existingTrades = raw.map(mapRow);
      const importMatches = matchTradesForImport(existingTrades, items);
      const seen = new Set(
        existingTrades
          .map((trade) => trade.importFingerprint)
          .filter((value): value is string => Boolean(value))
      );
      const results: TradeImportResult[] = [];
      const pending: TradeImport[] = [];
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const match = importMatches[index];
        if (match) {
          const rawRow = raw.find((row) => row.id === match.id);
          const existingDetails = rawRow?.details ?? {};
          const merged = applyImportToTrade(match, item);
          const closed = merged.status === "closed";
          const details = {
            ...existingDetails,
            shortStrike: item.shortStrike,
            longStrike: item.longStrike,
            callShortStrike: item.callShortStrike,
            callLongStrike: item.callLongStrike,
            stockPriceOpen: item.stockPriceOpen || match.stockPriceOpen,
            iv: item.iv || match.iv,
            delta: item.delta || match.delta,
            sigma: item.sigma || match.sigma,
            theta: item.theta || match.theta,
            commissionOpen: merged.commissionOpen,
            importSource: item.importSource,
            importFingerprint: item.importFingerprint,
            notes: [
              match.notes
                .replace("Imported from Robinhood activity CSV.", "")
                .replace("Closed from Robinhood activity CSV.", "")
                .replace("Opening credit added from Robinhood activity CSV.", "")
                .replace("Updated from Robinhood activity CSV.", "")
                .trim(),
              merged.note,
            ]
              .filter(Boolean)
              .join(" "),
            ...(closed
              ? {
                  stockPriceClose: merged.stockPriceClose ?? 0,
                  commissionClose: merged.commissionClose,
                  closeReason: merged.closeReason ?? "closed",
                }
              : {}),
          };
          const patch: Record<string, unknown> = {
            ticker: item.ticker.toUpperCase(),
            strategy: merged.strategy,
            status: merged.status,
            contracts: merged.contracts,
            expiry: item.expiry,
            open_date: merged.openDate,
            close_date: merged.closeDate,
            premium_open: merged.premiumOpen,
            premium_close: merged.premiumClose,
            pnl: closed
              ? realizedPnl(
                  merged.premiumOpen,
                  merged.premiumClose ?? 0,
                  merged.contracts,
                  merged.strategy,
                  {
                    commissionOpen: merged.commissionOpen,
                    commissionClose: merged.commissionClose,
                  }
                )
              : null,
            details,
          };
          const { data, error } = await supabase
            .from("tr_trades")
            .update(patch)
            .eq("id", match.id)
            .eq("user_id", userId)
            .select()
            .single();
          if (error || !data) {
            results.push({
              fingerprint: item.importFingerprint,
              status: "failed",
              error: error?.message ?? "Could not update the existing trade.",
            });
          } else {
            const duplicateCopies = staleCloseCopies(existingTrades, item, match);
            let cleanupError = "";
            for (const duplicateCopy of duplicateCopies) {
              const cleanup = await supabase
                .from("tr_trades")
                .delete()
                .eq("id", duplicateCopy.id)
                .eq("user_id", userId);
              if (cleanup.error) {
                cleanupError = cleanup.error.message;
                break;
              }
            }
            if (cleanupError) {
              results.push({
                fingerprint: item.importFingerprint,
                status: "failed",
                error: `Trade updated, but the earlier duplicate could not be removed: ${cleanupError}`,
              });
            } else {
              seen.add(item.importFingerprint);
              results.push({
                fingerprint: item.importFingerprint,
                status: "updated",
                trade: mapRow(data as TradeRow),
              });
            }
          }
          continue;
        }
        if (
          seen.has(item.importFingerprint) ||
          existingTrades.some((trade) => isDuplicateImportedTrade(trade, item))
        ) {
          results.push({
            fingerprint: item.importFingerprint,
            status: "duplicate",
          });
          continue;
        }
        seen.add(item.importFingerprint);
        pending.push(item);
      }

      const rowFor = (item: TradeImport) => ({
        user_id: userId,
        ticker: item.ticker.toUpperCase(),
        strategy: item.strategy,
        status: item.status,
        contracts: item.contracts,
        expiry: item.expiry,
        open_date: item.openDate,
        close_date: item.status === "closed" ? item.closeDate : null,
        premium_open: item.premiumOpen,
        premium_close: item.status === "closed" ? item.premiumClose ?? 0 : null,
        pnl:
          item.status === "closed"
            ? realizedPnl(
                item.premiumOpen,
                item.premiumClose ?? 0,
                item.contracts,
                item.strategy,
                {
                  commissionOpen: item.commissionOpen,
                  commissionClose: item.commissionClose,
                }
              )
            : null,
        details: {
          ...detailsFromTrade(item),
          stockPriceClose:
            item.status === "closed" ? item.stockPriceClose ?? 0 : null,
          commissionClose:
            item.status === "closed" ? item.commissionClose ?? 0 : 0,
          closeReason:
            item.status === "closed" ? item.closeReason ?? "closed" : null,
          importSource: item.importSource,
          importFingerprint: item.importFingerprint,
        },
      });

      if (pending.length) {
        const { data, error } = await supabase
          .from("tr_trades")
          .insert(pending.map(rowFor))
          .select();
        if (!error) {
          const created = ((data ?? []) as TradeRow[]).map(mapRow);
          created.forEach((trade) => {
            results.push({
              fingerprint: trade.importFingerprint ?? trade.id,
              status: "imported",
              trade,
            });
          });
        } else {
          // Preserve per-row feedback if one row causes a bulk insert to fail.
          for (const item of pending) {
            const single = await supabase
              .from("tr_trades")
              .insert(rowFor(item))
              .select()
              .single();
            if (single.error || !single.data) {
              results.push({
                fingerprint: item.importFingerprint,
                status: "failed",
                error: single.error?.message ?? "Supabase returned no trade.",
              });
            } else {
              results.push({
                fingerprint: item.importFingerprint,
                status: "imported",
                trade: mapRow(single.data as TradeRow),
              });
            }
          }
        }
      }
      return results;
    },

    async update(id: string, trade: TradeUpdate): Promise<Trade> {
      const { data: current, error: readError } = await supabase
        .from("tr_trades")
        .select("status, details, contracts, premium_open")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (readError || !current) {
        throw new Error(readError?.message ?? "Trade not found.");
      }
      const existingDetails =
        (current.details as Record<string, unknown> | null) ?? {};
      const details = detailsFromTrade(trade, existingDetails);
      const patch: Record<string, unknown> = {
        ticker: trade.ticker.toUpperCase(),
        strategy: trade.strategy,
        contracts: trade.contracts,
        expiry: trade.expiry,
        open_date: trade.openDate,
        premium_open: trade.premiumOpen,
        details,
      };
      if (current.status === "closed" && trade.premiumClose != null && trade.closeDate) {
        patch.close_date = trade.closeDate;
        patch.premium_close = trade.premiumClose;
        patch.pnl = realizedPnl(
          trade.premiumOpen,
          trade.premiumClose,
          trade.contracts,
          trade.strategy,
          {
            commissionOpen: trade.commissionOpen,
            commissionClose: trade.commissionClose,
          }
        );
        patch.details = {
          ...details,
          stockPriceClose: trade.stockPriceClose ?? existingDetails.stockPriceClose ?? null,
          commissionClose:
            trade.commissionClose ?? existingDetails.commissionClose ?? 0,
          closeReason: trade.closeReason ?? existingDetails.closeReason ?? "closed",
        };
      }
      const { data, error } = await supabase
        .from("tr_trades")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      return requireRow(data, error);
    },

    async close(id: string, payload: ClosePayload): Promise<Trade> {
      const { data: current, error: readError } = await supabase
        .from("tr_trades")
        .select("premium_open, contracts, details, strategy")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (readError || !current) {
        throw new Error(readError?.message ?? "Trade not found.");
      }
      const existingDetails =
        (current.details as Record<string, unknown> | null) ?? {};
      const pnl = realizedPnl(
        Number(current.premium_open),
        payload.premiumClose,
        Number(current.contracts),
        String(current.strategy),
        {
          commissionOpen: number(existingDetails, "commissionOpen"),
          commissionClose: payload.commissionClose,
        }
      );
      const { data, error } = await supabase
        .from("tr_trades")
        .update({
          status: "closed",
          close_date: payload.closeDate,
          premium_close: payload.premiumClose,
          pnl,
          details: {
            ...existingDetails,
            stockPriceClose: payload.stockPriceClose,
            commissionClose: payload.commissionClose ?? 0,
            closeReason: payload.closeReason ?? "closed",
          },
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      return requireRow(data, error);
    },

    async remove(id: string): Promise<void> {
      const { error } = await supabase
        .from("tr_trades")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },

    async removeAll(): Promise<number> {
      let removed = 0;
      for (let pass = 0; pass < 50; pass++) {
        const { data, error } = await supabase
          .from("tr_trades")
          .delete()
          .eq("user_id", userId)
          .select("id");
        if (error) throw new Error(error.message);
        const count = data?.length ?? 0;
        removed += count;
        if (count < 1000) return removed;
      }
      throw new Error("Could not delete every trade. Try again.");
    },
  };
}
