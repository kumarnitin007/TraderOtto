"use client";

import type { ReactNode } from "react";

export type TabOption<T extends string> = {
  value: T;
  label: string;
  title?: string;
};

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  end,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  end?: ReactNode;
}) {
  return (
    <div className="flex items-end gap-5 border-b border-otto-divider">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title ?? o.label}
          onClick={() => onChange(o.value)}
          className={`mb-[-1px] shrink-0 border-none bg-transparent pb-2.5 text-sm font-semibold ${
            value === o.value
              ? "border-b-2 border-b-otto-green text-otto-text"
              : "border-b-2 border-b-transparent text-otto-text-faint"
          }`}
        >
          {o.label}
        </button>
      ))}
      {end ? <div className="ml-auto shrink-0 pb-2.5">{end}</div> : null}
    </div>
  );
}
