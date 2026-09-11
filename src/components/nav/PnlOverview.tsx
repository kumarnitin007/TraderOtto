"use client";

import { useEffect, useRef, useState } from "react";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useTrades } from "@/hooks/useTrades";
import {
  fmtMoney,
  PNL_RANGE_OPTIONS,
  realizedInRange,
  unrealizedFromMarks,
  type PnlRange,
} from "@/lib/pnl";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const realized = realizedInRange(trades, range);
  const unrealized = unrealizedFromMarks(trades, marks);
  const total = realized + (unrealized ?? 0);
  const heading =
    PNL_RANGE_OPTIONS.find((option) => option.id === range)?.heading ?? "All-time P/L";

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function choose(next: PnlRange) {
    setRange(next);
    setMenuOpen(false);
  }

  const menu = menuOpen && (
    <div
      role="menu"
      className={`absolute z-20 min-w-[168px] rounded-xl border border-otto-divider bg-otto-bg py-1 shadow-lg ${
        compact ? "right-0 top-full mt-2" : "left-0 top-full mt-2"
      }`}
    >
      {PNL_RANGE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="menuitem"
          onClick={() => choose(option.id)}
          className={`flex w-full px-3 py-2 text-left text-[13px] font-semibold ${
            option.id === range ? "text-otto-green" : "text-otto-text-dim"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div ref={rootRef} className="relative mt-2.5 flex items-end justify-between gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="min-w-0 bg-transparent p-0 text-left"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <div className="mb-0.5 block text-[11px] font-medium text-otto-text-dim">
            {heading}
          </div>
          <div
            className={`truncate text-[26px] font-extrabold leading-tight tracking-[-0.5px] ${moneyClass(total)}`}
          >
            {formatSigned(total)}
          </div>
        </button>
        <StatPill
          label="Realized"
          value={realized}
          onClick={() => setMenuOpen((open) => !open)}
        />
        {menu}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="w-full bg-transparent p-0 text-left"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <div className="mb-1.5 block text-xs font-medium text-otto-text-dim">{heading}</div>
        <div className={`text-[26px] font-extrabold ${moneyClass(total)}`}>
          {formatSigned(total)}
        </div>
      </button>
      <div className="mt-3.5">
        <StatPill
          label="Realized"
          value={realized}
          onClick={() => setMenuOpen((open) => !open)}
        />
      </div>
      {menu}
    </div>
  );
}

function StatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number | null;
  onClick: () => void;
}) {
  const unknown = value == null;
  const positive = (value ?? 0) >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[11px] py-[5px] text-[12.5px] font-semibold ${
        unknown
          ? "bg-otto-surface text-otto-text-faint"
          : positive
            ? "bg-otto-green-soft text-otto-green"
            : "bg-otto-red-soft text-otto-red"
      }`}
    >
      {label}{" "}
      <span>{unknown ? "—" : `${positive ? "+" : ""}${fmtMoney(value ?? 0)}`}</span>
    </button>
  );
}
