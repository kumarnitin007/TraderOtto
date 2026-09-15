import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClosedTradeImport,
  ClosePayload,
  NewTrade,
  Trade,
  TradeUpdate,
} from "@/types/trade";
import { realizedPnl } from "@/lib/pnl";
import { isDuplicateClosedTrade } from "@/lib/tradeDuplicate";

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
      return requireRow(data, error);
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
            trade.strategy
          ),
          details: {
            ...detailsFromTrade(trade),
            stockPriceClose: trade.stockPriceClose,
          },
        })
        .select()
        .single();
      return requireRow(data, error);
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
          trade.strategy
        );
        patch.details = {
          ...details,
          stockPriceClose: trade.stockPriceClose ?? existingDetails.stockPriceClose ?? null,
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
        String(current.strategy)
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
  };
}
