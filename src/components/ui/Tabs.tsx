"use client";

export type TabOption<T extends string> = { value: T; label: string };

export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-5 border-b border-otto-divider">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`mb-[-1px] border-none bg-transparent pb-2.5 text-sm font-semibold ${
            value === o.value
              ? "border-b-2 border-b-otto-green text-otto-text"
              : "border-b-2 border-b-transparent text-otto-text-faint"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
