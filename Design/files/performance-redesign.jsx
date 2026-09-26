import React, { useState, useMemo } from "react";
import { ChevronDown, Sparkles, Info } from "lucide-react";

/* ---------------------------------------------------------
   Trader Otto — Performance screen redesign
   Colors sampled directly from the shipped app screenshot:
   bg          #F6EFE2   page background (warm cream)
   card        #EBDFCB   card / stat-tile surface
   text        #2D241B   primary text (warm near-black)
   textDim     #8A7A63   secondary text
   textFaint   #B3A489   tertiary / placeholder
   green       #2F7A36   positive / credit / primary accent
   red         #B5452B   negative / unrealized loss
   avatar colors match the existing app: blue/purple/red/teal/amber
--------------------------------------------------------- */

const T = {
  bg: "#F6EFE2",
  card: "#EBDFCB",
  cardBorder: "#E1D3B6",
  text: "#2D241B",
  textDim: "#8A7A63",
  textFaint: "#B3A489",
  green: "#2F7A36",
  greenSoft: "rgba(47,122,54,0.12)",
  red: "#B5452B",
  redSoft: "rgba(181,69,43,0.12)",
};
const AVATAR = ["#1F6FEB", "#8957E5", "#E5484D", "#0EA5A5", "#E2A03F"];
const seed = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
const avatarColor = (t) => AVATAR[Math.abs(seed(t)) % AVATAR.length];

/* Normalize share classes so GOOG / GOOGL roll up into one row everywhere
   they're aggregated. Trade-level records keep their original ticker. */
const normalizeTicker = (t) => (t === "GOOG" ? "GOOGL" : t);

/* ---- real data, pulled from trader-otto-journal-2026-09-20.csv ---- */
const TRADES = [
  { id: "aed4", ticker: "HOOD", strategy: "Call Credit Spread", status: "open", open_date: "2026-09-18", short_strike: 135, long_strike: 140, premium_open: 0.85, capital_used: 415 },
  { id: "f547", ticker: "GOOG", strategy: "Put Credit Spread", status: "open", open_date: "2026-09-18", short_strike: 325, long_strike: 305, premium_open: 2.25, capital_used: 1775 },
  { id: "63d0", ticker: "NBIS", strategy: "Put Credit Spread", status: "open", open_date: "2026-09-18", short_strike: 175, long_strike: 165, premium_open: 1.42, capital_used: 858 },
  { id: "2c5f", ticker: "SPXW", strategy: "Call Credit Spread", status: "closed", close_date: "2026-09-18", realized_pnl: 63, capital_used: 700, roi_percent: 9.0, annualized_roi_percent: 3285, hold_days: 1 },
  { id: "dfbe", ticker: "INTC", strategy: "Call Credit Spread", status: "open", open_date: "2026-09-17", short_strike: 120, long_strike: 125, premium_open: 1.08, capital_used: 392 },
  { id: "6420", ticker: "AMD", strategy: "Call Credit Spread", status: "open", open_date: "2026-09-17", short_strike: 575, long_strike: 580, premium_open: 1.52, capital_used: 348 },
  { id: "66bf", ticker: "HOOD", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-18", realized_pnl: 111, capital_used: 846, roi_percent: 13.1, annualized_roi_percent: 2395, hold_days: 2 },
  { id: "7434", ticker: "MRVL", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-16", realized_pnl: 23, capital_used: 415, roi_percent: 5.5, annualized_roi_percent: 1011, hold_days: 2 },
  { id: "22f4", ticker: "NVDA", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-18", realized_pnl: 98, capital_used: 846, roi_percent: 11.6, annualized_roi_percent: 1057, hold_days: 4 },
  { id: "abb4", ticker: "INTC", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-17", realized_pnl: 82, capital_used: 381, roi_percent: 21.5, annualized_roi_percent: 2619, hold_days: 3 },
  { id: "f947", ticker: "NVDA", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-09", realized_pnl: 112, capital_used: 884, roi_percent: 12.7, annualized_roi_percent: 4624, hold_days: 1 },
  { id: "984f", ticker: "MRVL", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-09", realized_pnl: 111, capital_used: 847, roi_percent: 13.1, annualized_roi_percent: 4783, hold_days: 1 },
  { id: "16a7", ticker: "AMD", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-09", realized_pnl: 207, capital_used: 1750, roi_percent: 11.8, annualized_roi_percent: 4317, hold_days: 1 },
  { id: "b49f", ticker: "INTC", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-08", realized_pnl: 138, capital_used: 349, roi_percent: 39.5, annualized_roi_percent: 14433, hold_days: 1 },
  { id: "42f1", ticker: "AMZN", strategy: "Put Credit Spread", status: "open", open_date: "2026-09-08", short_strike: 240, long_strike: 220, premium_open: 2.19, capital_used: 1781 },
  { id: "3027", ticker: "MSFT", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-14", realized_pnl: 149, capital_used: 1731, roi_percent: 8.6, annualized_roi_percent: 524, hold_days: 6 },
  { id: "49c9", ticker: "NVDA", strategy: "Put Credit Spread", status: "open", open_date: "2026-09-08", short_strike: 210, long_strike: 190, premium_open: 1.79, capital_used: 1821 },
  { id: "0e82", ticker: "TSLA", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-16", realized_pnl: 135, capital_used: 1768, roi_percent: 7.6, annualized_roi_percent: 232, hold_days: 12 },
  { id: "c81c", ticker: "AAPL", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-11", realized_pnl: 139, capital_used: 1799, roi_percent: 7.7, annualized_roi_percent: 403, hold_days: 7 },
  { id: "6a1e", ticker: "AMZN", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-18", realized_pnl: 40, capital_used: 926, roi_percent: 4.3, annualized_roi_percent: 88, hold_days: 18 },
  { id: "5865", ticker: "GOOGL", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-14", realized_pnl: 162, capital_used: 1788, roi_percent: 9.1, annualized_roi_percent: 236, hold_days: 14 },
  { id: "8d7d", ticker: "COST", strategy: "Put Credit Spread", status: "open", open_date: "2026-08-28", short_strike: 900, long_strike: 895, premium_open: 1.0, capital_used: 400 },
  { id: "2132", ticker: "XPEV", strategy: "Covered Call", status: "closed", close_date: "2026-09-17", realized_pnl: 38, capital_used: 1200, roi_percent: 3.2, annualized_roi_percent: 55, hold_days: 21 },
  { id: "5f5c", ticker: "GOOGL", strategy: "Put Credit Spread", status: "closed", close_date: "2026-09-11", realized_pnl: 100, capital_used: 900, roi_percent: 11.1, annualized_roi_percent: 176, hold_days: 23 },
];

const CLOSED = TRADES.filter((t) => t.status === "closed");
const OPEN_PUTS = TRADES.filter((t) => t.status === "open" && t.strategy === "Put Credit Spread");

const fmt = (n) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/* Fix for the misleading-annualized-% problem: under a 5-day hold, an
   annualized figure is more noise than signal, so show $/day (velocity)
   instead. At or above 5 days, show the annualized figure, capped so a
   single outlier can't dominate the row. */
function velocityLabel(t) {
  if (t.hold_days < 5) {
    const perDay = t.realized_pnl / Math.max(t.hold_days, 1);
    return { text: `$${perDay.toFixed(0)}/day · ${t.hold_days}d hold`, muted: true };
  }
  const capped = Math.min(t.annualized_roi_percent, 999);
  const suffix = t.annualized_roi_percent > 999 ? "+" : "";
  return { text: `${capped.toFixed(0)}${suffix}%/yr`, muted: false };
}

function groupBy(list, keyFn) {
  const map = new Map();
  list.forEach((t) => {
    const k = keyFn(t);
    if (!map.has(k)) map.set(k, { key: k, pnl: 0, count: 0 });
    const e = map.get(k);
    e.pnl += t.realized_pnl;
    e.count += 1;
  });
  return Array.from(map.values()).sort((a, b) => b.pnl - a.pnl);
}

function cumulativeSeries() {
  const sorted = [...CLOSED].sort((a, b) => (a.close_date < b.close_date ? -1 : 1));
  let run = 0;
  const byDate = new Map();
  sorted.forEach((t) => {
    run += t.realized_pnl;
    byDate.set(t.close_date, run);
  });
  return Array.from(byDate.entries()).map(([date, cum]) => ({ date, cum }));
}

export default function PerformanceScreen() {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("weekly");

  const totalRealized = CLOSED.reduce((s, t) => s + t.realized_pnl, 0);
  const winCount = CLOSED.filter((t) => t.realized_pnl > 0).length;
  const winRate = Math.round((winCount / CLOSED.length) * 100);
  const wins = CLOSED.filter((t) => t.realized_pnl > 0);
  const losses = CLOSED.filter((t) => t.realized_pnl < 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.realized_pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.realized_pnl, 0) / losses.length : null;

  const byTicker = useMemo(() => groupBy(CLOSED, (t) => normalizeTicker(t.ticker)), []);
  const byStrategy = useMemo(() => groupBy(CLOSED, (t) => t.strategy), []);
  const cumulative = useMemo(() => cumulativeSeries(), []);

  const assignmentTotal = OPEN_PUTS.reduce((s, t) => s + t.short_strike * 100, 0);
  const creditHeld = OPEN_PUTS.reduce((s, t) => s + t.premium_open * 100, 0);
  const concentration = OPEN_PUTS
    .map((t) => ({ ticker: t.ticker, amt: t.short_strike * 100 }))
    .sort((a, b) => b.amt - a.amt);
  const biggest = concentration[0];

  const capitalTrades = [...CLOSED].sort((a, b) => (a.close_date < b.close_date ? -1 : 1));
  const minCap = Math.min(...capitalTrades.map((t) => t.capital_used));
  const maxCap = Math.max(...capitalTrades.map((t) => t.capital_used));

  const weekly = [
    { label: "Week of Sep 14", pnl: 901, count: 10 },
    { label: "Week of Sep 7", pnl: 807, count: 6 },
  ];

  const closedSorted = [...CLOSED].sort((a, b) => (a.close_date < b.close_date ? 1 : -1));

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; font-variant-numeric: tabular-nums; }
        button { font-family: 'Inter', sans-serif; cursor: pointer; color: inherit; }
      `}</style>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "20px 18px 60px" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Trader Otto</div>
          <div style={{ background: T.card, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: T.textDim }}>Closed</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 3 }}>Unrealized</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.red }}>-$130.50</div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>open marks</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 3 }}>Realized ▾</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>+{fmt(totalRealized)}</div>
            <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>Last 12 months</div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 20, borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 16 }}>
          {[
            { v: "overview", l: "Overview" },
            { v: "ticker", l: "By ticker" },
            { v: "strategy", l: "By strategy" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setTab(o.v)}
              style={{
                background: "transparent", border: "none", padding: "0 0 10px",
                fontSize: 14, fontWeight: 600,
                color: tab === o.v ? T.text : T.textFaint,
                borderBottom: tab === o.v ? `2px solid ${T.green}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {o.l}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            {/* filter row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.card, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13.5, fontWeight: 500 }}>
              Last 12 months <ChevronDown size={15} color={T.textDim} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button style={{ display: "flex", alignItems: "center", gap: 6, background: T.text, color: T.bg, borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none" }}>
                <Sparkles size={14} /> Ask Otto
              </button>
              <button style={{ background: T.card, borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none", color: T.text }}>Realized</button>
              <button style={{ background: "transparent", borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 600, border: `1px solid ${T.cardBorder}`, color: T.textDim }}>Include open</button>
            </div>

            {/* stat grid — unchanged from shipped app */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <StatTile label="Last 12 months" value={`+${fmt(totalRealized)}`} accent={T.green} />
              <StatTile label="Trades" value={CLOSED.length} sub="closed in period" />
              <StatTile label="Wins" value={winCount} sub="profitable trades" />
              <StatTile label="Win rate" value={`${winRate}%`} sub={`${winCount}/${CLOSED.length} closed`} />
            </div>

            {/* NEW: avg win / avg loss, ready for the day a loss shows up */}
            <div style={{ background: T.card, borderRadius: 12, padding: "13px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 3 }}>Avg win</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>+{fmt(avgWin)}</div>
              </div>
              <div style={{ width: 1, height: 28, background: T.cardBorder }} />
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 3 }}>Avg loss</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: avgLoss ? T.red : T.textFaint }}>
                  {avgLoss ? fmt(avgLoss) : "— no losses yet"}
                </div>
              </div>
            </div>

            {/* assignment cash backup, + NEW concentration bar */}
            <div style={{ background: T.card, borderRadius: 14, padding: "16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, color: T.textDim }}>Assignment cash backup</div>
                <div style={{ fontSize: 19, fontWeight: 800 }}>{fmt(assignmentTotal)}</div>
              </div>
              <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 12 }}>
                {OPEN_PUTS.length} short-put positions · {OPEN_PUTS.length * 100} shares if all assigned
              </div>

              {/* NEW: concentration by ticker */}
              <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                {concentration.map((c) => (
                  <div key={c.ticker} style={{ width: `${(c.amt / assignmentTotal) * 100}%`, background: avatarColor(c.ticker) }} title={c.ticker} />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                {concentration.map((c) => (
                  <div key={c.ticker} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.textDim }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: avatarColor(c.ticker), display: "inline-block" }} />
                    {c.ticker} {Math.round((c.amt / assignmentTotal) * 100)}%
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <MiniStat label="Biggest name" value={biggest.ticker} sub={`${fmt(biggest.amt)} · ${Math.round((biggest.amt / assignmentTotal) * 100)}%`} />
                <MiniStat label="Credit held" value={fmt(creditHeld)} sub="premium on these legs" />
                <MiniStat label="Open puts" value={OPEN_PUTS.length} sub="carry assignment risk" />
              </div>
            </div>

            {/* NEW: cumulative realized P/L */}
            <div style={{ background: T.card, borderRadius: 14, padding: "16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, color: T.textDim }}>Growth since Aug 19</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.green }}>+{fmt(totalRealized)}</div>
              </div>
              <CumulativeChart points={cumulative} />
            </div>

            {/* NEW: position sizing consistency strip */}
            <div style={{ background: T.card, borderRadius: 14, padding: "16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <div style={{ fontSize: 12.5, color: T.textDim }}>Capital per trade</div>
                <div style={{ fontSize: 11, color: T.textFaint }}>{fmt(minCap)} – {fmt(maxCap)}</div>
              </div>
              <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 10 }}>
                {(maxCap / minCap).toFixed(1)}x range across your closed trades — worth a sizing rule
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
                {capitalTrades.map((t) => (
                  <div
                    key={t.id}
                    title={`${t.ticker} · ${fmt(t.capital_used)}`}
                    style={{ flex: 1, height: `${(t.capital_used / maxCap) * 100}%`, background: avatarColor(t.ticker), borderRadius: 2, minWidth: 4 }}
                  />
                ))}
              </div>
            </div>

            {/* weekly / monthly — unchanged structure */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: T.textDim }}>Last 12 months · {CLOSED.length} closed trades · {winCount} wins</span>
              <div style={{ display: "flex", gap: 14 }}>
                {["Weekly", "Monthly"].map((l) => (
                  <button
                    key={l}
                    onClick={() => setPeriod(l.toLowerCase())}
                    style={{ background: "transparent", border: "none", fontSize: 12.5, fontWeight: 600, color: period === l.toLowerCase() ? T.text : T.textFaint, padding: 0, borderBottom: period === l.toLowerCase() ? `2px solid ${T.green}` : "none" }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {weekly.map((w) => (
              <div key={w.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{w.label}</span>
                  <span style={{ fontWeight: 700, color: T.green }}>+{fmt(w.pnl)}</span>
                </div>
                <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 4 }}>{w.count} trades</div>
                <div style={{ height: 7, background: "rgba(0,0,0,0.06)", borderRadius: 999 }}>
                  <div style={{ width: `${(w.pnl / 901) * 100}%`, height: "100%", background: T.green, borderRadius: 999 }} />
                </div>
              </div>
            ))}

            {/* closed trades list, with fixed velocity/annualized display */}
            <div style={{ fontSize: 13, fontWeight: 700, margin: "22px 0 10px" }}>Closed trades</div>
            {closedSorted.map((t) => {
              const v = velocityLabel(t);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: avatarColor(t.ticker), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {t.ticker.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.ticker} <span style={{ fontWeight: 500, color: T.textDim, fontSize: 12.5 }}>{t.strategy}</span></div>
                    <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 2 }}>
                      closed {fmtDate(t.close_date)} · {fmt(t.capital_used)} capital
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.green }}>+{fmt(t.realized_pnl)}</div>
                    <div style={{ fontSize: 11, marginTop: 2, color: v.muted ? T.textFaint : T.green }}>
                      {t.roi_percent.toFixed(1)}% · {v.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === "ticker" && <BreakdownList rows={byTicker} nameKey="ticker" total={totalRealized} />}
        {tab === "strategy" && <BreakdownList rows={byStrategy} nameKey="strategy" total={totalRealized} />}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{ background: T.card, borderRadius: 12, padding: "13px 14px" }}>
      <div style={{ fontSize: 11.5, color: T.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent || T.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.textFaint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
function MiniStat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: T.textFaint, marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function CumulativeChart({ points }) {
  const w = 360, h = 84, pad = 4;
  const max = Math.max(...points.map((p) => p.cum));
  const min = 0;
  const stepX = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => [pad + i * stepX, h - pad - ((p.cum - min) / (max - min)) * (h - pad * 2)]);
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0]},${c[1]}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${h} L${coords[0][0]},${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={areaPath} fill={T.green} opacity="0.12" />
      <path d={linePath} fill="none" stroke={T.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c[0]} cy={c[1]} r="2.5" fill={T.green} />
      ))}
    </svg>
  );
}

function BreakdownList({ rows, nameKey, total }) {
  const max = Math.max(...rows.map((r) => r.pnl));
  return (
    <div style={{ marginTop: 8 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ padding: "12px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: avatarColor(r.key), display: "inline-block" }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{r.key}</span>
              <span style={{ fontSize: 11.5, color: T.textFaint }}>{r.count} trade{r.count > 1 ? "s" : ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: T.textFaint }}>{Math.round((r.pnl / total) * 100)}% of total</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.green }}>+{fmt(r.pnl)}</span>
            </div>
          </div>
          <div style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 999 }}>
            <div style={{ width: `${(r.pnl / max) * 100}%`, height: "100%", background: avatarColor(r.key), borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
