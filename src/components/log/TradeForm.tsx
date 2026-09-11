"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Pencil, Plus, Trash2, X, Zap } from "lucide-react";
import { STRATEGIES, type NewTrade, type Strategy, type Trade } from "@/types/trade";
import { useTrades } from "@/hooks/useTrades";
import { fmtDate, todayISO } from "@/lib/pnl";
import { QuickQuoteButton } from "@/components/ui/QuickQuoteButton";
import { useAlpacaConnection } from "@/components/alpaca/AlpacaConnectionProvider";
import { parseRobinhoodScreenshot } from "@/lib/robinhoodScreenshot";
import { WatchGroupsPanel } from "@/components/groups/WatchGroupsPanel";

type FormState = {
  ticker: string;
  strategy: Strategy;
  expiry: string;
  contracts: string;
  shortStrike: string;
  longStrike: string;
  callShort: string;
  callLong: string;
  openDate: string;
  stockPriceOpen: string;
  iv: string;
  delta: string;
  sigma: string;
  theta: string;
  premiumOpen: string;
  notes: string;
};

function blankForm(): FormState {
  return {
    ticker: "",
    strategy: STRATEGIES[0],
    expiry: "",
    contracts: "1",
    shortStrike: "",
    longStrike: "",
    callShort: "",
    callLong: "",
    openDate: todayISO(),
    stockPriceOpen: "",
    iv: "",
    delta: "",
    sigma: "",
    theta: "",
    premiumOpen: "",
    notes: "",
  };
}

function tradeToForm(trade: Trade): FormState {
  return {
    ticker: trade.ticker,
    strategy: trade.strategy as Strategy,
    expiry: trade.expiry,
    contracts: String(trade.contracts),
    shortStrike: trade.shortStrike == null ? "" : String(trade.shortStrike),
    longStrike: trade.longStrike == null ? "" : String(trade.longStrike),
    callShort: trade.callShortStrike == null ? "" : String(trade.callShortStrike),
    callLong: trade.callLongStrike == null ? "" : String(trade.callLongStrike),
    openDate: trade.openDate,
    stockPriceOpen: String(trade.stockPriceOpen || ""),
    iv: String(trade.iv || ""),
    delta: String(trade.delta || ""),
    sigma: String(trade.sigma || ""),
    theta: String(trade.theta || ""),
    premiumOpen: String(trade.premiumOpen),
    notes: trade.notes,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-7 text-[13px] font-bold uppercase tracking-[0.4px] text-otto-text-dim">
      {children}
    </div>
  );
}

function ScreenshotInput({
  compact = false,
  progress,
  onFile,
}: {
  compact?: boolean;
  progress: number | null;
  onFile: (file?: File) => void;
}) {
  const busy = progress != null;
  const size = compact ? 14 : 16;
  const label = busy
    ? compact
      ? `${progress}%`
      : `Reading screenshot… ${progress}%`
    : compact
      ? "Screenshot"
      : "Import and prefill from screenshot";

  return (
    <label
      className={`flex items-center gap-1.5 font-semibold text-otto-text-dim ${
        compact
          ? "shrink-0 rounded-full border border-otto-divider px-3 py-1.5 text-[12px]"
          : "justify-center gap-2 rounded-xl border border-dashed border-otto-divider bg-otto-surface px-4 py-3 text-[13px]"
      } ${busy ? "cursor-wait opacity-70" : "cursor-pointer hover:bg-otto-surface-raise"}`}
    >
      {busy ? <LoaderCircle size={size} className="otto-spin" /> : <Camera size={size} />}
      {label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          // Allow re-picking the same file after a failed read.
          event.target.value = "";
        }}
      />
    </label>
  );
}

export function TradeForm() {
  const { trades, addTrade, updateTrade, deleteTrade } = useTrades();
  const { state: alpacaState } = useAlpacaConnection();
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"new" | "edit" | "groups">("new");
  const [editFilter, setEditFilter] = useState<"open" | "closed">("open");
  const [selectedId, setSelectedId] = useState("");
  const [f, setF] = useState<FormState>(blankForm);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [ocrResult, setOcrResult] = useState("");
  const [ocrSource, setOcrSource] = useState<"top" | "bottom">("top");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editableTrades = trades.filter((trade) => trade.status === editFilter);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });
  const isCondor = f.strategy === "Iron Condor";

  function chooseTrade(id: string) {
    setSelectedId(id);
    const trade = trades.find((item) => item.id === id);
    if (trade) setF(tradeToForm(trade));
    setError("");
    setConfirmDelete(false);
  }

  function switchMode(next: "new" | "edit" | "groups") {
    setMode(next);
    setError("");
    setConfirmDelete(false);
    if (next === "new" || next === "groups") {
      setSelectedId("");
      setF(blankForm());
      return;
    }
    const first = trades.find((trade) => trade.status === editFilter);
    if (first) chooseTrade(first.id);
  }

  function changeEditFilter(next: "open" | "closed") {
    setEditFilter(next);
    const first = trades.find((trade) => trade.status === next);
    setSelectedId(first?.id ?? "");
    setF(first ? tradeToForm(first) : blankForm());
    setError("");
    setConfirmDelete(false);
  }

  async function removeSelected() {
    if (!selectedId) return;
    await deleteTrade(selectedId);
    setConfirmDelete(false);
    const next = trades.find(
      (trade) => trade.id !== selectedId && trade.status === editFilter
    );
    setSelectedId(next?.id ?? "");
    setF(next ? tradeToForm(next) : blankForm());
  }

  async function submit() {
    if (!f.ticker || !f.expiry || !f.premiumOpen) {
      setError("Ticker, expiry, and premium are required.");
      return;
    }
    if (!f.shortStrike) {
      setError("Enter the short strike (the option you sold).");
      return;
    }
    if (f.strategy !== "Strangle" && !f.longStrike) {
      setError("Enter the long strike (the option you bought).");
      return;
    }
    setError("");
    const trade: NewTrade = {
      ticker: f.ticker.toUpperCase(),
      strategy: f.strategy,
      contracts: parseInt(f.contracts, 10) || 1,
      expiry: f.expiry,
      openDate: f.openDate,
      shortStrike: parseFloat(f.shortStrike) || null,
      longStrike: parseFloat(f.longStrike) || null,
      callShortStrike: isCondor ? parseFloat(f.callShort) || null : null,
      callLongStrike: isCondor ? parseFloat(f.callLong) || null : null,
      stockPriceOpen: parseFloat(f.stockPriceOpen) || 0,
      iv: parseFloat(f.iv) || 0,
      delta: parseFloat(f.delta) || 0,
      sigma: parseFloat(f.sigma) || 0,
      theta: parseFloat(f.theta) || 0,
      premiumOpen: parseFloat(f.premiumOpen) || 0,
      notes: f.notes,
    };
    if (mode === "edit" && selectedId) {
      await updateTrade(selectedId, trade);
    } else {
      await addTrade(trade);
    }
    router.push("/positions");
  }

  const banner = {
    checking: {
      text: "Checking the Alpaca market-data connection…",
      color: "text-otto-text-faint",
    },
    live: {
      text: "Alpaca connected. Real-time prices are active.",
      color: "text-otto-green",
    },
    simulated: {
      text: "Alpaca live market data is not connected. Stock prices shown in the app are simulated.",
      color: "text-otto-amber",
    },
    offline: {
      text: "Alpaca is offline. Real-time prices and option data are unavailable.",
      color: "text-otto-red",
    },
  }[alpacaState];

  async function loadScreenshot(file: File | undefined, source: "top" | "bottom") {
    if (!file) return;
    setError("");
    setOcrResult("");
    setOcrSource(source);
    setOcrProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setOcrProgress(Math.round(message.progress * 100));
          }
        },
      });
      try {
        const result = await worker.recognize(file);
        const parsed = parseRobinhoodScreenshot(result.data.text);
        const populated = Object.entries(parsed).filter(
          ([key, value]) => key !== "notes" && value != null && value !== ""
        ).length;
        setF((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(parsed).filter(([, value]) => value != null && value !== "")
          ),
          notes: [current.notes, parsed.notes].filter(Boolean).join(" "),
        }));
        setOcrResult(
          populated
            ? `Prefilled ${populated} fields. Review them before saving—the screenshot was not stored.`
            : "No trade fields were recognized. Try a clearer, uncropped position screenshot."
        );
      } finally {
        await worker.terminate();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this screenshot.");
    } finally {
      setOcrProgress(null);
    }
  }

  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-otto-divider">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => switchMode("new")}
            className={`mb-[-1px] border-b-2 pb-2.5 text-sm font-semibold ${
              mode === "new"
                ? "border-otto-green text-otto-text"
                : "border-transparent text-otto-text-faint"
            }`}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => switchMode("edit")}
            className={`mb-[-1px] border-b-2 pb-2.5 text-sm font-semibold ${
              mode === "edit"
                ? "border-otto-green text-otto-text"
                : "border-transparent text-otto-text-faint"
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => switchMode("groups")}
            className={`mb-[-1px] border-b-2 pb-2.5 text-sm font-semibold ${
              mode === "groups"
                ? "border-otto-green text-otto-text"
                : "border-transparent text-otto-text-faint"
            }`}
          >
            Groups
          </button>
        </div>
        <div className={`pb-2 ${mode === "groups" ? "hidden" : ""}`}>
          <ScreenshotInput
            compact
            progress={ocrProgress}
            onFile={(file) => void loadScreenshot(file, "top")}
          />
        </div>
      </div>

      {ocrResult && ocrSource === "top" && (
        <div className="mb-4 text-[12.5px] font-medium text-otto-green">{ocrResult}</div>
      )}

      {mode === "groups" ? (
        <WatchGroupsPanel />
      ) : (
        <>
      {mode === "edit" && (
        <div className="mb-5 rounded-xl bg-otto-surface px-3.5 py-3">
          <div className="mb-3 flex gap-2">
            {(["open", "closed"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => changeEditFilter(status)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                  editFilter === status
                    ? "bg-otto-green text-black"
                    : "border border-otto-divider text-otto-text-dim"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <Field label="Trade to edit">
            <select value={selectedId} onChange={(event) => chooseTrade(event.target.value)}>
              {editableTrades.length === 0 && (
                <option value="">No {editFilter} trades</option>
              )}
              {editableTrades.map((trade) => (
                <option key={trade.id} value={trade.id}>
                  {trade.ticker} · {trade.strategy} · {fmtDate(trade.openDate)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {showBanner && (
        <div className="mb-1 flex items-start gap-2.5 rounded-xl border border-otto-divider bg-otto-surface px-3.5 py-3">
          <Zap size={15} className={`mt-0.5 shrink-0 ${banner.color}`} />
          <div className={`text-[12.5px] leading-[1.5] ${banner.color}`}>
            {banner.text}
          </div>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="shrink-0 border-none bg-transparent text-otto-text-faint"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <SectionLabel>Trade</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ticker">
          <input
            className="uppercase"
            placeholder="AAPL"
            value={f.ticker}
            onChange={set("ticker")}
          />
        </Field>
        <Field label="Contracts">
          <input type="number" value={f.contracts} onChange={set("contracts")} />
        </Field>
        <Field label="Strategy">
          <select
            value={f.strategy}
            onChange={(e) => setF({ ...f, strategy: e.target.value as Strategy })}
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expiry">
          <input type="date" value={f.expiry} onChange={set("expiry")} />
        </Field>
      </div>

      <SectionLabel>Strikes &amp; premium</SectionLabel>
      <p className="mb-3 text-[12.5px] leading-snug text-otto-text-faint">
        Credit spread: short = strike you sold, long = strike you bought. Premium is per
        contract (so $212 collected on 1 contract is 2.12, not 212).
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label={isCondor ? "Put short strike (sold)" : "Short strike (sold)"}>
          <input type="number" placeholder="320" value={f.shortStrike} onChange={set("shortStrike")} />
        </Field>
        <Field label={isCondor ? "Put long strike (bought)" : "Long strike (bought)"}>
          <input type="number" placeholder="300" value={f.longStrike} onChange={set("longStrike")} />
        </Field>
        {isCondor && (
          <>
            <Field label="Call short strike">
              <input type="number" placeholder="0" value={f.callShort} onChange={set("callShort")} />
            </Field>
            <Field label="Call long strike">
              <input type="number" placeholder="0" value={f.callLong} onChange={set("callLong")} />
            </Field>
          </>
        )}
        <Field label="Open date">
          <input type="date" value={f.openDate} onChange={set("openDate")} />
        </Field>
        <Field label="Premium ($ / contract)">
          <input
            type="number"
            placeholder="0.00"
            value={f.premiumOpen}
            onChange={set("premiumOpen")}
          />
        </Field>
      </div>

      <SectionLabel>Market snapshot</SectionLabel>
      <p className="mb-3 text-[12.5px] leading-snug text-otto-text-faint">
        Optional at open. Open positions pull live IV, delta, and theta from Alpaca when
        available. A Robinhood screenshot does not include these numbers.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Stock price">
          <div className="flex items-end gap-1.5">
            <input
              type="number"
              placeholder="0.00"
              value={f.stockPriceOpen}
              onChange={set("stockPriceOpen")}
            />
            <QuickQuoteButton
              ticker={f.ticker}
              onFill={(p) => setF((prev) => ({ ...prev, stockPriceOpen: p }))}
            />
          </div>
        </Field>
        <Field label="IV %">
          <input type="number" placeholder="0.0" value={f.iv} onChange={set("iv")} />
        </Field>
        <Field label="Delta">
          <input type="number" placeholder="0.00" value={f.delta} onChange={set("delta")} />
        </Field>
        <Field label="Sigma">
          <input type="number" placeholder="0.00" value={f.sigma} onChange={set("sigma")} />
        </Field>
        <Field label="Theta">
          <input type="number" placeholder="0.00" value={f.theta} onChange={set("theta")} />
        </Field>
      </div>

      <SectionLabel>Notes</SectionLabel>
      <textarea
        rows={3}
        placeholder="Optional — thesis, adjustment plan, etc."
        value={f.notes}
        onChange={set("notes")}
      />

      <SectionLabel>Robinhood screenshot</SectionLabel>
      <p className="mb-3 text-[12.5px] leading-snug text-otto-text-faint">
        Import a position screenshot to prefill recognized fields. The image is processed locally
        and discarded—it is not saved with the trade.
      </p>
      <ScreenshotInput
        progress={ocrProgress}
        onFile={(file) => void loadScreenshot(file, "bottom")}
      />
      {ocrResult && ocrSource === "bottom" && (
        <div className="mt-3 text-[12.5px] font-medium text-otto-green">
          {ocrResult}
        </div>
      )}

      {error && (
        <div className="mt-4 text-[13px] font-medium text-otto-red">{error}</div>
      )}
      <div className="mt-[26px] flex gap-2">
        <button
          type="button"
          onClick={submit}
          className="flex flex-[2] items-center justify-center gap-1.5 rounded-full border-none bg-otto-green py-3.5 text-[15px] font-bold text-black"
        >
          {mode === "edit" ? (
            <Pencil size={17} strokeWidth={2.4} />
          ) : (
            <Plus size={17} strokeWidth={2.6} />
          )}
          {mode === "edit" ? "Update trade" : "Save trade"}
        </button>
        {mode === "edit" && selectedId && (
          <button
            type="button"
            onClick={() => (confirmDelete ? void removeSelected() : setConfirmDelete(true))}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-3.5 text-[13.5px] font-semibold ${
              confirmDelete
                ? "border border-otto-red bg-otto-red-soft text-otto-red"
                : "border border-otto-divider bg-transparent text-otto-text-dim"
            }`}
          >
            <Trash2 size={16} />
            {confirmDelete ? "Tap to confirm" : "Delete"}
          </button>
        )}
      </div>
      <div className="h-4" />
        </>
      )}
    </div>
  );
}
