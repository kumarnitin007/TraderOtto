import { BookOpen, Library, Star, Tags } from "lucide-react";
import { bookStats } from "@/lib/books";
import type { Book } from "@/types/book";

export function BooksStatsScreen({ books }: { books: Book[] }) {
  const stats = bookStats(books);
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Reading at a glance
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Stats</h1>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat icon={Library} label="In library" value={String(stats.total)} />
        <Stat icon={BookOpen} label="Reading" value={String(stats.reading)} />
        <Stat icon={Star} label="Average rating" value={stats.averageRating?.toFixed(1) ?? "—"} />
        <Stat icon={BookOpen} label="Pages completed" value={stats.pagesRead.toLocaleString()} />
      </div>

      <div className="mt-5 rounded-2xl bg-otto-surface p-4">
        <div className="flex items-center gap-2">
          <Tags size={17} className="text-otto-green" />
          <h2 className="text-[14px] font-bold">Top tags</h2>
        </div>
        {stats.topTags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.topTags.map(([tag, count]) => (
              <span
                key={tag}
                className="rounded-full bg-otto-green-soft px-3 py-1.5 text-[12px] font-semibold text-otto-green"
              >
                {tag} · {count}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-otto-text-dim">
            Add tags to books to see your reading themes.
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-otto-surface p-4">
      <Icon size={18} className="text-otto-green" />
      <b className="mt-4 block text-[23px]">{value}</b>
      <span className="text-[11.5px] text-otto-text-dim">{label}</span>
    </div>
  );
}
