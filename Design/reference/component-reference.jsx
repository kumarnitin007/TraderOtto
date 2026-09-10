import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Rows3,
  PenLine,
  LineChart,
  ChevronDown,
  Plus,
  Zap,
  X,
  RefreshCw,
} from "lucide-react";

/* ---------------------------------------------------------
   Premium Ledger — Robinhood-inspired dark UI
   bg      #000000   true black, edge to edge
   surface #111214   inputs / raised surfaces only
   divider #23252A   hairlines
   text    #FFFFFF
   textDim #8A8D93
   textFaint #55585E
   green   #00C805   up / credit / profit  (Robinhood green)
   red     #FF5000   down / debit / loss   (Robinhood red)
   One typeface throughout: Inter, tabular numerals everywhere.
--------------------------------------------------------- */

const T = {
  bg: "#000000",
  surface: "#111214",
  surfaceRaise: "#18191C",
  divider: "#232529",
  text: "#FFFFFF",
  textDim: "#8A8D93",
  textFaint: "#55585E",
  green: "#00C805",
  greenSoft: "rgba(0,200,5,0.12)",
  red: "#FF5000",
  redSoft: "rgba(255,80,0,0.12)",
};

const STRATEGIES = [
  "Put Credit Spread",
  "Call Credit Spread",
  "Put Debit Spread",
  "Call Debit Spread",
  "Iron Condor",
  "Covered Call",
  "Cash-Secured Put",
  "Strangle",
];

const BASE_PRICES = {
  AAPL: 195.4, SPY: 572.1, TSLA: 254.8, MSFT: 429.6, NVDA: 139.9,
  QQQ: 483.2, AMD: 147.6, META: 612.3, AMZN: 231.7, GOOGL: 196.4,
};

const uid = () => Math.random().toString(36).slice(2, 9);

/* deterministic seeded rng so sparklines don't jump every render */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function sparkPoints(ticker, base) {
  const rng = mulberry32(seedFromString(ticker));
  let v = base * 0.985;
  const pts = [v];
  for (let i = 0; i < 13; i++) {
    v += (rng() - 0.48) * base * 0.006;
    pts.push(v);
  }
  return pts;
}

/* ---- simulated Alpaca Market Data quote ---- */
function fetchAlpacaQuote(symbol) {
  return new Promise((resolve) => {
    const base = BASE_PRICES[symbol.toUpperCase()] || 80 + (seedFromString(symbol) % 400);
    const jitter = (Math.random() - 0.5) * base * 0.01;
    setTimeout(() => {
      resolve({ symbol: symbol.toUpperCase(), price: +(base + jitter).toFixed(2), ts: Date.now() });
    }, 550 + Math.random() * 450);
  });
}

const seedTrades = [
  {
    id: uid(), ticker: "AAPL", strategy: "Put Credit Spread", side: "Put",
    expiry: "2026-10-16", contracts: 2, shortStrike: 190, longStrike: 185,
    openDate: "2026-09-02", stockPriceOpen: 194.20, iv: 27.8, delta: -0.18, sigma: 0.16, theta: 0.05,
    premiumOpen: 1.35, status: "open", callShort: "", callLong: "",
  },
  {
    id: uid(), ticker: "SPY", strategy: "Iron Condor", side: "Put",
    expiry: "2026-09-19", contracts: 1, shortStrike: 555, longStrike: 550,
    callShort: 585, callLong: 590,
    openDate: "2026-08-28", stockPriceOpen: 570.40, iv: 15.2, delta: 0.02, sigma: 0.14, theta: 0.09,
    premiumOpen: 2.10, status: "open",
  },
  {
    id: uid(), ticker: "TSLA", strategy: "Call Debit Spread", side: "Call",
    expiry: "2026-09-05", contracts: 1, shortStrike: 260, longStrike: 250,
    openDate: "2026-08-11", stockPriceOpen: 248.10, iv: 41.6, delta: 0.31, sigma: 0.30, theta: -0.06,
    premiumOpen: -3.20, status: "closed", closeDate: "2026-09-04",
    stockPriceClose: 261.40, premiumClose: -6.10,
  },
  {
    id: uid(), ticker: "MSFT", strategy: "Put Credit Spread", side: "Put",
    expiry: "2026-08-22", contracts: 3, shortStrike: 415, longStrike: 405,
    openDate: "2026-08-01", stockPriceOpen: 428.60, iv: 22.1, delta: -0.16, sigma: 0.17, theta: 0.04,
    premiumOpen: 1.10, status: "closed", closeDate: "2026-08-21",
    stockPriceClose: 431.90, premiumClose: 0.12,
  },
  {
    id: uid(), ticker: "NVDA", strategy: "Call Credit Spread", side: "Call",
    expiry: "2026-08-15", contracts: 2, shortStrike: 138, longStrike: 145,
    openDate: "2026-07-28", stockPriceOpen: 129.80, iv: 46.3, delta: 0.19, sigma: 0.32, theta: 0.07,
    premiumOpen: 1.85, status: "closed", closeDate: "2026-08-14",
    stockPriceClose: 141.20, premiumClose: 3.90,
  },
  {
    id: uid(), ticker: "QQQ", strategy: "Put Credit Spread", side: "Put",
    expiry: "2026-07-18", contracts: 2, shortStrike: 470, longStrike: 460,
    openDate: "2026-06-30", stockPriceOpen: 482.10, iv: 18.4, delta: -0.14, sigma: 0.15, theta: 0.05,
    premiumOpen: 1.55, status: "closed", closeDate: "2026-07-17",
    stockPriceClose: 486.00, premiumClose: 0.05,
  },
  {
    id: uid(), ticker: "AMD", strategy: "Strangle", side: "Put",
    expiry: "2026-06-20", contracts: 1, shortStrike: 145, longStrike: "",
    openDate: "2026-06-05", stockPriceOpen: 152.30, iv: 38.9, delta: -0.20, sigma: 0.28, theta: 0.08,
    premiumOpen: 2.40, status: "closed", closeDate: "2026-06-19",
    stockPriceClose: 132.10, premiumClose: 8.60,
  },
];

const fmtMoney = (n) => {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function tradePnl(t) {
  if (t.status !== "closed") return null;
  return (t.premiumOpen - t.premiumClose) * t.contracts * 100;
}
function monthKey(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function weekKey(d) {
  const dt = new Date(d + "T00:00:00");
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diff);
  return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default function App() {
  const [tab, setTab] = useState("positions");
  const [filter, setFilter] = useState("open");
  const [period, setPeriod] = useState("monthly");
  const [expanded, setExpanded] = useState(null);
  const [trades, setTrades] = useState(seedTrades);
  const [closingId, setClosingId] = useState(null);
  const [showBanner, setShowBanner] = useState(true);

  /* ---- live price feed (simulated Alpaca stream) ---- */
  const openTickers = useMemo(
    () => Array.from(new Set(trades.filter((t) => t.status === "open").map((t) => t.ticker))),
    [trades]
  );
  const [live, setLive] = useState({});
  useEffect(() => {
    setLive((prev) => {
      const next = { ...prev };
      openTickers.forEach((tk) => {
        if (!next[tk]) {
          const t = trades.find((x) => x.ticker === tk);
          next[tk] = { price: t.stockPriceOpen, dir: 0 };
        }
      });
      return next;
    });
    const iv = setInterval(() => {
      setLive((prev) => {
        const next = { ...prev };
        openTickers.forEach((tk) => {
          const cur = next[tk]?.price ?? BASE_PRICES[tk] ?? 100;
          const delta = (Math.random() - 0.5) * cur * 0.0035;
          next[tk] = { price: +(cur + delta).toFixed(2), dir: delta >= 0 ? 1 : -1 };
        });
        return next;
      });
    }, 3200);
    return () => clearInterval(iv);
  }, [openTickers.join(",")]);

  const now = new Date("2026-09-09T00:00:00");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const closedTrades = trades.filter((t) => t.status === "closed");
  const mtd = closedTrades.filter((t) => new Date(t.closeDate + "T00:00:00") >= monthStart).reduce((s, t) => s + tradePnl(t), 0);
  const wtd = (() => {
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return closedTrades.filter((t) => new Date(t.closeDate + "T00:00:00") >= monday).reduce((s, t) => s + tradePnl(t), 0);
  })();
  const allTime = closedTrades.reduce((s, t) => s + tradePnl(t), 0);
  const winRate = closedTrades.length
    ? Math.round((closedTrades.filter((t) => tradePnl(t) > 0).length / closedTrades.length) * 100)
    : 0;

  const grouped = useMemo(() => {
    const keyFn = period === "monthly" ? monthKey : weekKey;
    const map = new Map();
    closedTrades.forEach((t) => {
      const k = keyFn(t.closeDate);
      const pnl = tradePnl(t);
      if (!map.has(k)) map.set(k, { key: k, pnl: 0, count: 0, sortDate: t.closeDate });
      const entry = map.get(k);
      entry.pnl += pnl;
      entry.count += 1;
      if (t.closeDate > entry.sortDate) entry.sortDate = t.closeDate;
    });
    return Array.from(map.values()).sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1));
  }, [trades, period]);
  const maxAbs = Math.max(1, ...grouped.map((g) => Math.abs(g.pnl)));

  const visibleTrades = trades
    .filter((t) => (filter === "all" ? true : t.status === filter))
    .sort((a, b) => (a.openDate < b.openDate ? 1 : -1));

  function addTrade(trade) {
    setTrades((prev) => [{ ...trade, id: uid(), status: "open" }, ...prev]);
    setTab("positions");
    setFilter("open");
  }
  function closeTrade(id, payload) {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...payload, status: "closed" } : t)));
    setClosingId(null);
    setExpanded(null);
  }

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'Inter', sans-serif", minHeight: "100vh", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; font-variant-numeric: tabular-nums; }
        input, select, textarea {
          font-family: 'Inter', sans-serif;
          background: transparent;
          border: none;
          border-bottom: 1.5px solid ${T.divider};
          color: ${T.text};
          border-radius: 0;
          padding: 10px 2px;
          font-size: 15.5px;
          width: 100%;
          outline: none;
        }
        input::placeholder { color: ${T.textFaint}; }
        input:focus, select:focus, textarea:focus { border-bottom-color: ${T.green}; }
        select { appearance: none; -webkit-appearance: none; background-image: none; }
        textarea { border: 1px solid ${T.divider}; border-radius: 10px; padding: 10px; }
        textarea:focus { border-color: ${T.green}; }
        button { font-family: 'Inter', sans-serif; cursor: pointer; color: inherit; }
        ::-webkit-scrollbar { width: 0px; height: 0px; }
        .field-label { font-size: 12px; color: ${T.textDim}; margin-bottom: 6px; display:block; font-weight: 500; }
        @keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      <div style={{ display: "flex", maxWidth: 1180, margin: "0 auto" }}>
        <aside className="side-nav" style={{ width: 236, flexShrink: 0, borderRight: `1px solid ${T.divider}`, padding: "28px 20px", display: "none", minHeight: "100vh" }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3 }}>Premium Ledger</div>
          <div style={{ color: T.textFaint, fontSize: 12.5, marginTop: 3, marginBottom: 30 }}>Options trade journal</div>

          <NavButton icon={Rows3} label="Positions" active={tab === "positions"} onClick={() => setTab("positions")} />
          <NavButton icon={PenLine} label="Log trade" active={tab === "log"} onClick={() => setTab("log")} />
          <NavButton icon={LineChart} label="Performance" active={tab === "perf"} onClick={() => setTab("perf")} />

          <div style={{ marginTop: 34, paddingTop: 20, borderTop: `1px solid ${T.divider}` }}>
            <div className="field-label">All-time P/L</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: allTime >= 0 ? T.green : T.red }}>
              {allTime >= 0 ? "+" : ""}{fmtMoney(allTime)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Pill label="Month" value={mtd} />
              <Pill label="Week" value={wtd} />
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="field-label">Win rate</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{winRate}%</div>
            </div>
          </div>

          <AlpacaStatus />
        </aside>

        <main style={{ flex: 1, minWidth: 0, paddingBottom: 96 }}>
          <header className="mobile-header" style={{ padding: "20px 18px 6px", position: "sticky", top: 0, background: T.bg, zIndex: 5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2 }}>Premium Ledger</div>
              <AlpacaStatus compact />
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="field-label" style={{ marginBottom: 4 }}>All-time P/L</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.5, color: T.text }}>
                {allTime >= 0 ? "+" : ""}{fmtMoney(allTime)}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Pill label="This month" value={mtd} />
                <Pill label="This week" value={wtd} />
              </div>
            </div>
          </header>

          <div style={{ padding: "14px 18px 0" }}>
            {tab === "positions" && (
              <PositionsView
                trades={visibleTrades}
                filter={filter}
                setFilter={setFilter}
                expanded={expanded}
                setExpanded={setExpanded}
                closingId={closingId}
                setClosingId={setClosingId}
                closeTrade={closeTrade}
                live={live}
              />
            )}
            {tab === "log" && <LogTradeView onSave={addTrade} showBanner={showBanner} setShowBanner={setShowBanner} />}
            {tab === "perf" && (
              <PerformanceView period={period} setPeriod={setPeriod} grouped={grouped} maxAbs={maxAbs} mtd={mtd} wtd={wtd} winRate={winRate} totalTrades={closedTrades.length} />
            )}
          </div>
        </main>
      </div>

      <nav className="bottom-nav" style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.86)", backdropFilter: "blur(14px)", borderTop: `1px solid ${T.divider}`, display: "flex", padding: "9px 8px calc(9px + env(safe-area-inset-bottom))", zIndex: 10 }}>
        <BottomTab icon={Rows3} label="Positions" active={tab === "positions"} onClick={() => setTab("positions")} />
        <BottomTab icon={PenLine} label="Log trade" active={tab === "log"} onClick={() => setTab("log")} />
        <BottomTab icon={LineChart} label="Performance" active={tab === "perf"} onClick={() => setTab("perf")} />
      </nav>

      <style>{`
        @media (min-width: 860px) {
          .side-nav { display: flex !important; flex-direction: column; }
          .bottom-nav { display: none !important; }
          .mobile-header { display: none !important; }
          main { padding-top: 28px; padding-left: 8px; padding-right: 8px; }
        }
      `}</style>
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function Pill({ label, value }) {
  const positive = value >= 0;
  return (
    <div style={{ background: positive ? T.greenSoft : T.redSoft, borderRadius: 999, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, color: positive ? T.green : T.red, display: "flex", alignItems: "center", gap: 5 }}>
      {label} <span>{positive ? "+" : ""}{fmtMoney(value)}</span>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 8px", borderRadius: 10, border: "none", background: active ? T.surface : "transparent", color: active ? T.text : T.textDim, marginBottom: 2, fontSize: 14.5, fontWeight: 600, textAlign: "left" }}>
      <Icon size={17} strokeWidth={2.2} color={active ? T.green : T.textFaint} />
      {label}
    </button>
  );
}

function BottomTab({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0 4px", background: "transparent", border: "none", color: active ? T.text : T.textFaint }}>
      <Icon size={21} strokeWidth={active ? 2.3 : 1.8} color={active ? T.green : T.textFaint} />
      <span style={{ fontSize: 10.5, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function Tabs({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 20, borderBottom: `1px solid ${T.divider}` }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ border: "none", background: "transparent", padding: "0 0 10px", fontSize: 14, fontWeight: 600, color: value === o.value ? T.text : T.textFaint, borderBottom: value === o.value ? `2px solid ${T.green}` : "2px solid transparent", marginBottom: -1 }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AlpacaStatus({ compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: compact ? 0 : 22, fontSize: compact ? 11.5 : 12, color: T.textFaint }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: T.green, display: "inline-block", animation: "pulseDot 1.8s ease-in-out infinite" }} />
      Alpaca market data <span style={{ color: T.textFaint }}>· simulated</span>
    </div>
  );
}

function Sparkline({ ticker, base, positive }) {
  const pts = useMemo(() => sparkPoints(ticker, base), [ticker, base]);
  const w = 60, h = 22;
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const path = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - ((p - min) / range) * h}`).join(" ");
  const color = positive ? T.green : T.red;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- Positions ---------------- */

function PositionsView({ trades, filter, setFilter, expanded, setExpanded, closingId, setClosingId, closeTrade, live }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Tabs value={filter} onChange={setFilter} options={[{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }]} />
      </div>

      <div className="desk-row" style={{ display: "none", gridTemplateColumns: "1fr 1.3fr 1fr 0.8fr 0.9fr", padding: "0 4px 10px", fontSize: 11, color: T.textFaint, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>
        <div>Ticker</div><div>Strategy</div><div>Strikes</div><div>Live</div><div style={{ textAlign: "right" }}>P/L</div>
      </div>

      {trades.length === 0 && (
        <div style={{ color: T.textFaint, fontSize: 14, padding: "40px 4px", textAlign: "center" }}>No trades here yet. Log one from the trade tab.</div>
      )}

      <div>
        {trades.map((t) => (
          <TradeRow key={t.id} t={t} open={expanded === t.id} onToggle={() => setExpanded(expanded === t.id ? null : t.id)} closing={closingId === t.id} onStartClose={() => setClosingId(t.id)} onCancelClose={() => setClosingId(null)} onConfirmClose={(payload) => closeTrade(t.id, payload)} live={live[t.ticker]} />
        ))}
      </div>

      <style>{` @media (min-width: 860px) { .desk-row { display: grid !important; } } `}</style>
    </div>
  );
}

function TradeRow({ t, open, onToggle, closing, onStartClose, onCancelClose, onConfirmClose, live }) {
  const pnl = tradePnl(t);
  const livePrice = live?.price ?? t.stockPriceOpen ?? t.stockPriceClose;
  const movedUp = livePrice >= (t.stockPriceOpen || 0);
  const [closeDate, setCloseDate] = useState(t.closeDate || "2026-09-09");
  const [stockPriceClose, setStockPriceClose] = useState(t.stockPriceClose || "");
  const [premiumClose, setPremiumClose] = useState(t.premiumClose || "");

  const strikesLabel =
    t.strategy === "Iron Condor" ? `${t.longStrike}/${t.shortStrike}P · ${t.callShort}/${t.callLong}C`
    : t.longStrike ? `${t.shortStrike} / ${t.longStrike}` : `${t.shortStrike}`;

  const avatarBg = ["#1F6FEB", "#8957E5", "#E5484D", "#0EA5A5", "#E2A03F"][seedFromString(t.ticker) % 5];

  return (
    <div style={{ borderBottom: `1px solid ${T.divider}` }}>
      <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: "none", padding: "13px 4px", textAlign: "left" }}>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
          {t.ticker.slice(0, 2)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{t.ticker}</span>
            <span style={{ fontSize: 12, color: T.textFaint }}>{t.strategy}</span>
          </div>
          <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>{strikesLabel} · exp {fmtDate(t.expiry)} · {t.contracts}x</div>
        </div>

        {t.status === "open" && (
          <div style={{ display: "none" }} className="row-spark">
            <Sparkline ticker={t.ticker} base={livePrice} positive={movedUp} />
          </div>
        )}

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {t.status === "open" ? (
            <>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>${livePrice.toFixed(2)}</div>
              <div style={{ fontSize: 11.5, color: movedUp ? T.green : T.red, marginTop: 2 }}>
                {movedUp ? "▲" : "▼"} vs ${Number(t.stockPriceOpen).toFixed(2)} open
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: pnl >= 0 ? T.green : T.red }}>{pnl >= 0 ? "+" : ""}{fmtMoney(pnl)}</div>
              <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 2 }}>closed {fmtDate(t.closeDate)}</div>
            </>
          )}
        </div>
        <ChevronDown size={15} color={T.textFaint} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ padding: "2px 4px 18px 50px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, paddingTop: 10 }}>
            <GreekReadout label="Open px" value={`$${Number(t.stockPriceOpen).toFixed(2)}`} />
            <GreekReadout label="IV" value={`${t.iv}%`} />
            <GreekReadout label="Delta" value={t.delta} />
            <GreekReadout label="Sigma" value={t.sigma} />
            <GreekReadout label="Theta" value={t.theta} />
            <GreekReadout label="Opened" value={fmtDate(t.openDate)} />
            {t.status === "open" && <GreekReadout label="Live px" value={`$${livePrice.toFixed(2)}`} accent={movedUp ? T.green : T.red} />}
            {t.status === "closed" && <GreekReadout label="Closed px" value={`$${Number(t.stockPriceClose).toFixed(2)}`} />}
            {t.status === "closed" && <GreekReadout label="Debit paid" value={t.premiumClose} />}
          </div>

          {t.status === "open" && !closing && (
            <button onClick={onStartClose} style={{ marginTop: 16, width: "100%", padding: "11px 0", borderRadius: 999, border: `1px solid ${T.divider}`, background: "transparent", color: T.text, fontSize: 13.5, fontWeight: 600 }}>
              Close position
            </button>
          )}

          {t.status === "open" && closing && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="field-label">Close date</label><input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></div>
                <div>
                  <label className="field-label">Stock price</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                    <input type="number" value={stockPriceClose} onChange={(e) => setStockPriceClose(e.target.value)} placeholder="0.00" />
                    <QuickQuoteButton ticker={t.ticker} onFill={(p) => setStockPriceClose(p)} />
                  </div>
                </div>
              </div>
              <div><label className="field-label">Premium paid to close ($ / contract)</label><input type="number" value={premiumClose} onChange={(e) => setPremiumClose(e.target.value)} placeholder="0.00" /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onCancelClose} style={{ flex: 1, padding: "11px 0", borderRadius: 999, border: `1px solid ${T.divider}`, background: "transparent", color: T.textDim, fontSize: 13.5 }}>Cancel</button>
                <button onClick={() => onConfirmClose({ closeDate, stockPriceClose: parseFloat(stockPriceClose) || 0, premiumClose: parseFloat(premiumClose) || 0 })} style={{ flex: 2, padding: "11px 0", borderRadius: 999, border: "none", background: T.green, color: "#000", fontSize: 13.5, fontWeight: 700 }}>
                  Confirm close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <style>{` @media (min-width: 860px) { .row-spark { display: block !important; margin-right: 14px; } } `}</style>
    </div>
  );
}

function GreekReadout({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: T.textFaint, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: accent || T.text }}>{value}</div>
    </div>
  );
}

/* ---------------- quick quote button (single fetch) ---------------- */

function QuickQuoteButton({ ticker, onFill, size = "sm" }) {
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);

  async function go() {
    if (!ticker) return;
    setLoading(true);
    const q = await fetchAlpacaQuote(ticker);
    onFill(q.price.toFixed(2));
    setLoading(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
  }

  return (
    <button
      onClick={go}
      disabled={loading || !ticker}
      style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 5,
        padding: size === "sm" ? "9px 11px" : "10px 14px",
        borderRadius: 999,
        border: `1px solid ${flash ? T.green : T.divider}`,
        background: flash ? T.greenSoft : T.surface,
        color: flash ? T.green : T.text,
        fontSize: 12.5, fontWeight: 600,
        opacity: ticker ? 1 : 0.4,
        transition: "all .2s",
      }}
    >
      {loading ? <RefreshCw size={13} className="spin" style={{ animation: "spin 0.8s linear infinite" }} /> : <Zap size={13} strokeWidth={2.4} />}
      {loading ? "Fetching" : "Live price"}
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </button>
  );
}

/* ---------------- Log trade form ---------------- */

function Field({ label, children }) {
  return (
    <div style={{ gridColumn: "span 1" }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
function SectionLabel({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: T.textDim, margin: "28px 0 12px", textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</div>;
}

function LogTradeView({ onSave, showBanner, setShowBanner }) {
  const [f, setF] = useState({
    ticker: "", strategy: STRATEGIES[0], expiry: "", contracts: 1,
    shortStrike: "", longStrike: "", callShort: "", callLong: "",
    openDate: "2026-09-09", stockPriceOpen: "", iv: "", delta: "", sigma: "", theta: "",
    premiumOpen: "", notes: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isCondor = f.strategy === "Iron Condor";

  function submit() {
    if (!f.ticker || !f.expiry || !f.premiumOpen) return;
    onSave({
      ...f,
      contracts: parseInt(f.contracts) || 1,
      shortStrike: parseFloat(f.shortStrike) || "",
      longStrike: parseFloat(f.longStrike) || "",
      callShort: isCondor ? parseFloat(f.callShort) || "" : "",
      callLong: isCondor ? parseFloat(f.callLong) || "" : "",
      stockPriceOpen: parseFloat(f.stockPriceOpen) || 0,
      iv: parseFloat(f.iv) || 0,
      delta: parseFloat(f.delta) || 0,
      sigma: parseFloat(f.sigma) || 0,
      theta: parseFloat(f.theta) || 0,
      premiumOpen: parseFloat(f.premiumOpen) || 0,
    });
    setF({ ...f, ticker: "", expiry: "", shortStrike: "", longStrike: "", callShort: "", callLong: "", premiumOpen: "", notes: "" });
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {showBanner && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: T.surface, border: `1px solid ${T.divider}`, borderRadius: 12, padding: "12px 14px", marginBottom: 4 }}>
          <Zap size={15} color={T.green} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: T.textDim, lineHeight: 1.5 }}>
            Live price uses simulated Alpaca Market Data quotes for this preview. A production build should
            call Alpaca from a small backend so your API key stays off the client and requests aren't
            blocked by browser CORS.
          </div>
          <button onClick={() => setShowBanner(false)} style={{ background: "transparent", border: "none", color: T.textFaint, flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      )}

      <SectionLabel>Trade</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Ticker"><input style={{ textTransform: "uppercase" }} placeholder="AAPL" value={f.ticker} onChange={set("ticker")} /></Field>
        <Field label="Contracts"><input type="number" value={f.contracts} onChange={set("contracts")} /></Field>
        <Field label="Strategy"><select value={f.strategy} onChange={set("strategy")}>{STRATEGIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Expiry"><input type="date" value={f.expiry} onChange={set("expiry")} /></Field>
      </div>

      <SectionLabel>Strikes &amp; premium</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label={isCondor ? "Put short strike" : "Short strike"}><input type="number" placeholder="0" value={f.shortStrike} onChange={set("shortStrike")} /></Field>
        <Field label={isCondor ? "Put long strike" : "Long strike"}><input type="number" placeholder="0" value={f.longStrike} onChange={set("longStrike")} /></Field>
        {isCondor && (
          <>
            <Field label="Call short strike"><input type="number" placeholder="0" value={f.callShort} onChange={set("callShort")} /></Field>
            <Field label="Call long strike"><input type="number" placeholder="0" value={f.callLong} onChange={set("callLong")} /></Field>
          </>
        )}
        <Field label="Open date"><input type="date" value={f.openDate} onChange={set("openDate")} /></Field>
        <Field label="Premium collected ($ / contract)"><input type="number" placeholder="0.00" value={f.premiumOpen} onChange={set("premiumOpen")} /></Field>
      </div>

      <SectionLabel>Market snapshot</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Stock price">
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <input type="number" placeholder="0.00" value={f.stockPriceOpen} onChange={set("stockPriceOpen")} />
            <QuickQuoteButton ticker={f.ticker} onFill={(p) => setF((prev) => ({ ...prev, stockPriceOpen: p }))} />
          </div>
        </Field>
        <Field label="IV %"><input type="number" placeholder="0.0" value={f.iv} onChange={set("iv")} /></Field>
        <Field label="Delta"><input type="number" placeholder="0.00" value={f.delta} onChange={set("delta")} /></Field>
        <Field label="Sigma"><input type="number" placeholder="0.00" value={f.sigma} onChange={set("sigma")} /></Field>
        <Field label="Theta"><input type="number" placeholder="0.00" value={f.theta} onChange={set("theta")} /></Field>
      </div>

      <SectionLabel>Notes</SectionLabel>
      <textarea rows={3} placeholder="Optional — thesis, adjustment plan, etc." value={f.notes} onChange={set("notes")} />

      <button onClick={submit} style={{ marginTop: 26, width: "100%", padding: "14px 0", borderRadius: 999, border: "none", background: T.green, color: "#000", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={17} strokeWidth={2.6} /> Save trade
      </button>
      <div style={{ height: 16 }} />
    </div>
  );
}

/* ---------------- Performance ---------------- */

function PerformanceView({ period, setPeriod, grouped, maxAbs, mtd, wtd, winRate, totalTrades }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "2px 0 22px" }}>
        <SummaryTile label="This month" value={mtd} />
        <SummaryTile label="This week" value={wtd} />
        <SummaryTile label="Win rate" value={null} display={`${winRate}%`} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: T.textFaint, paddingBottom: 12 }}>{totalTrades} closed trades</span>
        <Tabs value={period} onChange={setPeriod} options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />
      </div>

      <div>
        {grouped.length === 0 && <div style={{ color: T.textFaint, fontSize: 14, padding: "30px 4px", textAlign: "center" }}>Close some trades to see performance here.</div>}
        {grouped.map((g) => (
          <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: `1px solid ${T.divider}` }}>
            <div style={{ width: 100, flexShrink: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.key}</div>
              <div style={{ fontSize: 11, color: T.textFaint }}>{g.count} trade{g.count > 1 ? "s" : ""}</div>
            </div>
            <div style={{ flex: 1, height: 6, background: T.surface, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${(Math.abs(g.pnl) / maxAbs) * 100}%`, height: "100%", background: g.pnl >= 0 ? T.green : T.red, borderRadius: 999 }} />
            </div>
            <div style={{ width: 88, textAlign: "right", fontSize: 13.5, fontWeight: 700, color: g.pnl >= 0 ? T.green : T.red }}>{g.pnl >= 0 ? "+" : ""}{fmtMoney(g.pnl)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, display }) {
  const positive = value === null ? true : value >= 0;
  return (
    <div style={{ background: T.surface, borderRadius: 12, padding: "13px 14px" }}>
      <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: value === null ? T.text : positive ? T.green : T.red }}>
        {display ?? `${positive ? "+" : ""}${fmtMoney(value)}`}
      </div>
    </div>
  );
}
