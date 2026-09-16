export type AiHistoryItem = {
  id: string;
  createdAt: string;
  model: string | null;
};

export function AiReportHistory<T extends AiHistoryItem>({
  items,
  selectedId,
  onSelect,
}: {
  items: T[];
  selectedId: string | null;
  onSelect: (item: T) => void;
}) {
  if (!items.length) return null;
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        Saved report history
      </span>
      <select
        value={selectedId ?? items[0].id}
        onChange={(event) => {
          const item = items.find((entry) => entry.id === event.target.value);
          if (item) onSelect(item);
        }}
        className="w-full rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-xs"
      >
        {items.map((item, index) => (
          <option key={item.id} value={item.id}>
            {index === 0 ? "Latest · " : ""}
            {new Date(item.createdAt).toLocaleString()}
            {item.model ? ` · ${item.model}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
