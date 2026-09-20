"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useTrades } from "@/hooks/useTrades";
import {
  fmtMoney,
  PNL_RANGE_OPTIONS,
  realizedInRange,
  unrealizedFromMarks,
} from "@/lib/pnl";
import { tradesInScope } from "@/lib/tradeScope";

function moneyClass(value: number) {
  return value >= 0 ? "text-otto-green" : "text-otto-red";
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${fmtMoney(value)}`;
}

export function PnlOverview({ compact = false }: { compact?: boolean }) {
  const { trades } = useTrades();
  const marks = useOptionMarks(trades);
  const [range, setRange] = useScreenOption("pnlRange");
  const [tradeScope] = useScreenOption("tradeScope");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const scopedTrades = tradesInScope(trades, tradeScope);
  const realized = realizedInRange(scopedTrades, range);
  const unrealized = unrealizedFromMarks(scopedTrades, marks);
  const rangeLabel =
    PNL_RANGE_OPTIONS.find((option) => option.id === range)?.label ?? "All time";

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  return (
    <div
      className={`flex items-end justify-between gap-3 ${compact ? "mt-2.5" : ""}`}
    >
      <PnlStat
        compact={compact}
        label="Unrealized"
        caption="open marks"
        value={unrealized}
        align="left"
      />
      <div
        ref={pickerRef}
        className="relative min-w-0 flex-1 text-right"
      >
        <button
          type="button"
          onClick={() => setPickerOpen((current) => !current)}
          className="ml-auto block max-w-full bg-transparent p-0 text-right"
          aria-expanded={pickerOpen}
          aria-haspopup="menu"
          title="Change the realized P/L period"
        >
          <span
            className={`mb-0.5 flex items-center justify-end gap-1 font-medium text-otto-text-dim ${
              compact ? "text-[11px]" : "mb-1.5 text-xs"
            }`}
          >
            Realized
            <ChevronDown size={11} className="shrink-0" />
          </span>
          <span
            className={`block font-extrabold leading-tight tracking-[-0.5px] ${
              compact ? "truncate text-[26px]" : "text-[17px] tabular-nums"
            } ${moneyClass(realized)}`}
          >
            {formatSigned(realized)}
          </span>
          <span
            className={`mt-0.5 block truncate text-otto-text-faint ${
              compact ? "text-[10px]" : "text-[10.5px]"
            }`}
          >
            {rangeLabel}
          </span>
        </button>

        {pickerOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1.5 w-[150px] overflow-hidden rounded-xl border border-otto-divider bg-otto-bg py-1 text-left shadow-2xl"
          >
            {PNL_RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={option.id === range}
                onClick={() => {
                  setRange(option.id);
                  setPickerOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-xs font-semibold ${
                  option.id === range
                    ? "bg-otto-surface text-otto-text"
                    : "text-otto-text-dim"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PnlStat({
  compact,
  label,
  caption,
  value,
  align,
}: {
  compact: boolean;
  label: string;
  caption?: string;
  value: number | null;
  align: "left" | "right";
}) {
  return (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : "text-left"}`}>
      <div
        className={`mb-0.5 block font-medium text-otto-text-dim ${
          compact ? "text-[11px]" : "mb-1.5 text-xs"
        }`}
      >
        {label}
      </div>
      <div
        className={`font-extrabold leading-tight tracking-[-0.5px] ${
          compact ? "truncate text-[26px]" : "text-[17px] tabular-nums"
        } ${value == null ? "text-otto-text-faint" : moneyClass(value)}`}
      >
        {value == null ? "—" : formatSigned(value)}
      </div>
      {caption && (
        <div
          className={`mt-0.5 truncate text-otto-text-faint ${
            compact ? "text-[10px]" : "text-[10.5px]"
          }`}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
