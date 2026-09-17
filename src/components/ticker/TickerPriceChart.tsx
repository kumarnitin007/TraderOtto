"use client";

import type { TickerDetails } from "@/types/tickerDetails";

export type ChartLevel = {
  label: string;
  price: number;
};

function pathFrom(
  values: Array<number | null>,
  x: (index: number) => number,
  y: (value: number) => number
) {
  let d = "";
  values.forEach((value, index) => {
    if (value == null) return;
    d += `${d ? " L" : "M"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
  });
  return d;
}

export function TickerPriceChart({
  chart,
  levels = [],
}: {
  chart: TickerDetails["chart"];
  levels?: ChartLevel[];
}) {
  if (!chart?.length) return null;

  const width = 400;
  const height = 168;
  const padL = 8;
  const padR = 52;
  const padT = 10;
  const padB = 18;
  const series = [
    ...chart.map((point) => point.close),
    ...chart.map((point) => point.sma20).filter((value): value is number => value != null),
    ...chart.map((point) => point.sma50).filter((value): value is number => value != null),
  ];
  let min = Math.min(...series);
  let max = Math.max(...series);
  const pad = Math.max((max - min) * 0.35, 0.5);
  const visibleLevels = levels.filter(
    (level) => level.price >= min - pad && level.price <= max + pad
  );
  const prices = [...series, ...visibleLevels.map((level) => level.price)];
  min = Math.min(...prices);
  max = Math.max(...prices);
  const span = Math.max(max - min, 0.01);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const x = (index: number) =>
    padL + (chart.length === 1 ? innerW / 2 : (index / (chart.length - 1)) * innerW);
  const y = (value: number) => padT + ((max - value) / span) * innerH;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => min + span * (1 - ratio));
  const closePath = pathFrom(
    chart.map((point) => point.close),
    x,
    y
  );
  const sma20Path = pathFrom(
    chart.map((point) => point.sma20),
    x,
    y
  );
  const sma50Path = pathFrom(
    chart.map((point) => point.sma50),
    x,
    y
  );
  const last = chart.at(-1);
  const first = chart[0];

  return (
    <section className="mt-5">
      <div className="flex items-end justify-between gap-3">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-otto-text-faint">
          Price · 80 days
        </div>
        <div className="flex flex-wrap justify-end gap-x-3 text-[10px] font-semibold text-otto-text-faint">
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-2.5 bg-otto-text" /> Price
          </span>
          <span className="inline-flex items-center gap-1 text-otto-green">
            <span className="h-0.5 w-2.5 bg-otto-green" /> SMA20
            {last?.sma20 != null ? ` ${last.sma20.toFixed(2)}` : ""}
          </span>
          <span className="inline-flex items-center gap-1 text-otto-amber">
            <span className="h-0.5 w-2.5 bg-otto-amber" /> SMA50
            {last?.sma50 != null ? ` ${last.sma50.toFixed(2)}` : ""}
          </span>
        </div>
      </div>
      <div className="mt-2 overflow-hidden rounded-2xl bg-otto-surface px-2 py-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[168px] w-full"
          role="img"
          aria-label="Daily close with 20-day and 50-day moving averages"
        >
          {grid.map((value) => (
            <g key={value}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y(value)}
                y2={y(value)}
                stroke="rgb(var(--otto-divider))"
                strokeWidth="1"
              />
              <text
                x={width - padR + 6}
                y={y(value) + 3}
                fill="rgb(var(--otto-text-faint))"
                fontSize="9"
              >
                {value.toFixed(value >= 100 ? 0 : 2)}
              </text>
            </g>
          ))}
          {visibleLevels.map((level) => (
            <g key={`${level.label}-${level.price}`}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y(level.price)}
                y2={y(level.price)}
                stroke="rgb(var(--otto-red))"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
              />
              <text
                x={padL + 2}
                y={y(level.price) - 3}
                fill="rgb(var(--otto-red))"
                fontSize="8"
                fontWeight="600"
              >
                {level.label} {level.price}
              </text>
            </g>
          ))}
          {sma50Path && (
            <path
              d={sma50Path}
              fill="none"
              stroke="rgb(var(--otto-amber))"
              strokeWidth="1.5"
            />
          )}
          {sma20Path && (
            <path
              d={sma20Path}
              fill="none"
              stroke="rgb(var(--otto-green))"
              strokeWidth="1.5"
            />
          )}
          {closePath && (
            <path
              d={closePath}
              fill="none"
              stroke="rgb(var(--otto-text))"
              strokeWidth="1.75"
            />
          )}
        </svg>
        {first && last && (
          <div className="flex justify-between px-1 text-[10px] text-otto-text-faint">
            <span>{formatDay(first.t)}</span>
            <span>{formatDay(last.t)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
