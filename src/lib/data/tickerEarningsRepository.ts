import type { SupabaseClient } from "@supabase/supabase-js";

export type TickerEarnings = {
  ticker: string;
  earningsDate: string | null;
  earningsTiming: string | null;
  earningsCheckedAt: string | null;
};

type PrefsRow = {
  ticker: string;
  extras: Record<string, unknown> | null;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function mapRow(row: PrefsRow): TickerEarnings {
  const extras = row.extras ?? {};
  return {
    ticker: row.ticker,
    earningsDate: text(extras.earningsDate),
    earningsTiming: text(extras.earningsTiming),
    earningsCheckedAt: text(extras.earningsCheckedAt),
  };
}

export function createTickerEarningsRepository(
  supabase: SupabaseClient,
  userId: string
) {
  return {
    async list(tickers: string[]) {
      const symbols = Array.from(new Set(tickers.map((ticker) => ticker.toUpperCase())));
      if (!symbols.length) return [];
      const { data, error } = await supabase
        .from("tr_ticker_prefs")
        .select("ticker, extras")
        .eq("user_id", userId)
        .in("ticker", symbols)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return ((data ?? []) as PrefsRow[]).map(mapRow);
    },

    async save(
      ticker: string,
      earnings: Omit<TickerEarnings, "ticker">
    ) {
      const symbol = ticker.toUpperCase();
      const { data, error: readError } = await supabase
        .from("tr_ticker_prefs")
        .select("extras")
        .eq("user_id", userId)
        .eq("ticker", symbol)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      const extras = {
        ...((data?.extras as Record<string, unknown> | null) ?? {}),
        earningsDate: earnings.earningsDate,
        earningsTiming: earnings.earningsTiming,
        earningsCheckedAt: earnings.earningsCheckedAt,
      };
      const query = data
        ? supabase
            .from("tr_ticker_prefs")
            .update({ extras })
            .eq("user_id", userId)
            .eq("ticker", symbol)
        : supabase.from("tr_ticker_prefs").insert({
            user_id: userId,
            ticker: symbol,
            poll_mode: "normal",
            extras,
          });
      const { error } = await query;
      if (error) throw new Error(error.message);
    },
  };
}
