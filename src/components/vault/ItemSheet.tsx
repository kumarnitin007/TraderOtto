"use client";

import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Maximize2,
  Pencil,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { kindMeta } from "@/lib/vaultItemTypes";
import {
  type VaultHistoryEntry,
  type VaultItem,
  type VaultRepository,
  type VaultTag,
} from "@/lib/vaultRepository";

function Field({
  label,
  value,
  action,
  multiline,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="border-t border-otto-divider px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-otto-text-faint">
        {label}
      </span>
      <div className="mt-1 flex items-start justify-between gap-2">
        <strong
          className={`block flex-1 text-[15px] font-medium ${multiline ? "whitespace-pre-wrap" : ""}`}
        >
          {value}
        </strong>
        {action && <aside className="flex shrink-0 gap-1">{action}</aside>}
      </div>
    </div>
  );
}

export function ItemSheet({
  item,
  tags,
  repository,
  onClose,
  onCopy,
  onEdit,
  onDelete,
  onFavorite,
}: {
  item: VaultItem;
  tags: VaultTag[];
  repository: VaultRepository;
  onClose: () => void;
  onCopy: (value: string, label?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite: () => void;
}) {
  const [view, setView] = useState<"actions" | "details">("actions");
  const [show, setShow] = useState(false);
  const [history, setHistory] = useState<VaultHistoryEntry[]>([]);
  const meta = kindMeta(item.kind);
  const Icon = meta.icon;
  const itemTags = tags.filter((tag) => item.tags.includes(tag.id));
  const launchUrl = item.website
    ? /^https?:\/\//.test(item.website)
      ? item.website
      : `https://${item.website}`
    : "";

  useEffect(() => {
    void repository.listHistory(item.id).then(setHistory);
  }, [item.id, repository]);

  async function shareItem() {
    const shareData = {
      title: item.name,
      text: item.username ? `${item.name}\n${item.username}` : item.name,
      ...(launchUrl ? { url: launchUrl } : {}),
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => undefined);
      return;
    }
    onCopy([shareData.text, launchUrl].filter(Boolean).join("\n"), "Share details copied");
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 p-0 desk:items-center desk:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-[720px] flex-col rounded-t-[28px] bg-otto-bg shadow-2xl desk:rounded-[24px]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-otto-divider desk:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface text-otto-text-dim"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 px-4 pb-2 pt-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: item.color }}
          >
            <Icon size={26} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold">{item.name}</h2>
            <span className="text-[13px] text-otto-text-dim">
              {item.website || meta.title}
            </span>
          </div>
        </div>

        {view === "actions" ? (
          <div className="overflow-y-auto px-2 pb-5 pt-2">
            {launchUrl && (
              <SheetAction
                icon={ExternalLink}
                label="Launch"
                onClick={() => window.open(launchUrl, "_blank", "noopener,noreferrer")}
              />
            )}
            {item.username && (
              <SheetAction
                icon={Copy}
                label="Copy username"
                onClick={() => onCopy(item.username!, "Username copied")}
              />
            )}
            {item.password && (
              <SheetAction
                icon={Copy}
                label="Copy password"
                onClick={() => onCopy(item.password!, "Password copied")}
              />
            )}
            <SheetAction
              icon={Maximize2}
              label="View"
              onClick={() => setView("details")}
            />
            <SheetAction icon={Pencil} label="Edit" onClick={onEdit} />
            {item.password && (
              <SheetAction
                icon={Eye}
                label="Show password"
                onClick={() => {
                  setShow(true);
                  setView("details");
                }}
              />
            )}
            <SheetAction icon={Share2} label="Share" onClick={() => void shareItem()} />
            <SheetAction
              icon={Star}
              label={item.favorite ? "Remove favorite" : "Add favorite"}
              onClick={onFavorite}
              filled={item.favorite}
            />
            <SheetAction
              icon={Trash2}
              label="Delete"
              tone="danger"
              onClick={() => {
                if (window.confirm(`Delete "${item.name}"?`)) onDelete();
              }}
            />
          </div>
        ) : (
        <>
        <div className="overflow-y-auto pb-4">
          <Field label="Category" value={meta.title} />
          {item.username && (
            <Field
              label={meta.detailLabel}
              value={item.username}
              action={
                <button type="button" onClick={() => onCopy(item.username!)}>
                  <Copy size={18} />
                </button>
              }
            />
          )}
          {item.password && (
            <Field
              label={meta.secretLabel ?? "Password"}
              value={show ? item.password : "••••••••••••••"}
              action={
                <>
                  <button type="button" onClick={() => setShow(!show)}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCopy(item.password!, "Password copied")}
                  >
                    <Copy size={18} />
                  </button>
                </>
              }
            />
          )}
          {item.website && (
            <Field
              label="Website"
              value={item.website}
              action={
                <>
                  <a
                    href={launchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-8 items-center justify-center"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <button type="button" onClick={() => onCopy(item.website!, "URL copied")}>
                    <Copy size={18} />
                  </button>
                </>
              }
            />
          )}
          {item.note && <Field label="Notes" value={item.note} multiline />}
          {Object.entries(item.customFields ?? {}).map(([label, value]) => (
            <Field key={label} label={label} value={value} multiline />
          ))}
          {itemTags.length > 0 && (
            <div className="border-t border-otto-divider px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-otto-text-faint">
                Tags
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {itemTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-otto-surface px-2.5 py-1 text-[12px] font-medium"
                  >
                    <i
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {history.length > 0 && (
            <div className="border-t border-otto-divider px-4 py-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-otto-text-dim" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-otto-text-faint">
                  Change history
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {history.map((entry) => (
                  <div key={entry.id} className="rounded-lg bg-otto-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <b className="capitalize">{entry.action}</b>
                      <span className="text-otto-text-faint">
                        {new Date(entry.changedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-otto-text-dim">
                      {entry.source === "import" ? "CSV import" : "Manual change"}
                      {entry.fields.length
                        ? ` · ${entry.fields.map(formatHistoryField).join(", ")}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-otto-divider px-4 py-3">
          <button
            type="button"
            onClick={() => setView("actions")}
            className="flex flex-1 items-center justify-center rounded-xl bg-otto-surface py-2.5 text-[13px] font-semibold"
          >
            Actions
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-otto-green py-2.5 text-[13px] font-bold text-black"
          >
            <Pencil size={16} />
            Edit
          </button>
          <button
            type="button"
            onClick={onFavorite}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-otto-surface py-2.5 text-[13px] font-semibold"
          >
            <Star fill={item.favorite ? "currentColor" : "none"} size={16} />
            {item.favorite ? "Favorited" : "Favorite"}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function formatHistoryField(field: string): string {
  if (field === "kind") return "category";
  if (field === "customFields") return "additional fields";
  if (field === "deletedAt") return "deletion status";
  return field.replace(/([A-Z])/g, " $1").toLowerCase();
}

function SheetAction({
  icon: Icon,
  label,
  onClick,
  tone,
  filled,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  tone?: "danger";
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left text-[16px] font-medium hover:bg-otto-surface ${
        tone === "danger" ? "text-otto-red" : "text-otto-text"
      }`}
    >
      <Icon size={22} fill={filled ? "currentColor" : "none"} className="shrink-0" />
      {label}
    </button>
  );
}
