import { tradePnl } from "@/lib/pnl";
import { tradeRoi } from "@/lib/roi";
import { closedEarly } from "@/lib/tickerStats";
import type { Trade } from "@/types/trade";

const HEADERS = [
  "id",
  "ticker",
  "strategy",
  "status",
  "contracts",
  "open_date",
  "close_date",
  "expiry",
  "short_strike",
  "long_strike",
  "call_short_strike",
  "call_long_strike",
  "premium_open",
  "premium_close",
  "stock_price_open",
  "stock_price_close",
  "realized_pnl",
  "capital_used",
  "roi_percent",
  "annualized_roi_percent",
  "hold_days",
  "closed_early",
  "close_reason",
  "opening_fees",
  "closing_fees",
  "rolled_from_trade_id",
  "rolled_to_trade_id",
  "iv",
  "delta",
  "sigma",
  "theta",
  "notes",
  "created_at",
  "updated_at",
] as const;

function csv(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(trade: Trade) {
  const roi = tradeRoi(trade);
  return [
    trade.id,
    trade.ticker,
    trade.strategy,
    trade.status,
    trade.contracts,
    trade.openDate,
    trade.closeDate,
    trade.expiry,
    trade.shortStrike,
    trade.longStrike,
    trade.callShortStrike,
    trade.callLongStrike,
    trade.premiumOpen,
    trade.premiumClose,
    trade.stockPriceOpen,
    trade.stockPriceClose,
    tradePnl(trade),
    roi?.capital,
    roi == null ? null : roi.roi * 100,
    roi == null ? null : roi.annualized * 100,
    roi?.days,
    trade.status === "closed" ? closedEarly(trade) : null,
    trade.closeReason,
    trade.commissionOpen,
    trade.commissionClose,
    trade.rolledFromTradeId,
    trade.rolledToTradeId,
    trade.iv,
    trade.delta,
    trade.sigma,
    trade.theta,
    trade.notes,
    trade.createdAt,
    trade.updatedAt,
  ]
    .map(csv)
    .join(",");
}

export function journalCsv(trades: Trade[]) {
  return [
    HEADERS.join(","),
    ...trades
      .slice()
      .sort(
        (a, b) =>
          b.openDate.localeCompare(a.openDate) ||
          b.createdAt.localeCompare(a.createdAt)
      )
      .map(row),
  ].join("\r\n");
}

export function downloadJournalCsv(trades: Trade[]) {
  const blob = new Blob(["\uFEFF", journalCsv(trades)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `trader-otto-journal-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
