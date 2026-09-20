"use client";

import { useScreenOption } from "@/hooks/useScreenOption";

export function TradeScopeToggle({
  className = "",
  compact = false,
  spreadsFirst = false,
}: {
  className?: string;
  compact?: boolean;
  spreadsFirst?: boolean;
}) {
  const [scope, setScope] = useScreenOption("tradeScope");
  const options = spreadsFirst
    ? [
        { value: "credit_spreads" as const, label: "Spreads" },
        { value: "all" as const, label: compact ? "All" : "All trades" },
      ]
    : [
        { value: "all" as const, label: compact ? "All" : "All trades" },
        {
          value: "credit_spreads" as const,
          label: compact ? "Spreads" : "Spreads only",
        },
      ];
  return (
    <div
      className={`inline-flex rounded-full border border-otto-divider p-0.5 ${className}`}
      aria-label="Trade strategy scope"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setScope(option.value)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
            scope === option.value
              ? "bg-otto-text text-otto-bg"
              : "text-otto-text-dim"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
