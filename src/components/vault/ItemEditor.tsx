"use client";

import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ShieldCheck,
  X,
} from "lucide-react";
import { kindGroups, kindMeta } from "@/lib/vaultItemTypes";
import type { VaultItem, VaultKind, VaultTag } from "@/lib/vaultRepository";

export function ItemEditor({
  item,
  tags,
  onClose,
  onSave,
}: {
  item?: VaultItem;
  tags: VaultTag[];
  onClose: () => void;
  onSave: (item: VaultItem) => void;
}) {
  const [step, setStep] = useState<"kind" | "form">(item ? "form" : "kind");
  const [kind, setKind] = useState<VaultKind>(item?.kind ?? "login");
  const [name, setName] = useState(item?.name ?? "");
  const [username, setUsername] = useState(item?.username ?? "");
  const [password, setPassword] = useState(item?.password ?? "");
  const [website, setWebsite] = useState(item?.website ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(item?.tags ?? []);
  const [pickingTags, setPickingTags] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [show, setShow] = useState(false);

  const meta = kindMeta(kind);
  const KindIcon = meta.icon;
  const chosen = tags.filter((tag) => selectedTags.includes(tag.id));
  const available = tags.filter((tag) =>
    tag.name.toLowerCase().includes(tagQuery.toLowerCase())
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...(item ?? {}),
      id: item?.id ?? crypto.randomUUID(),
      kind,
      name: name.trim(),
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      website: website.trim() || undefined,
      note: note.trim() || undefined,
      tags: selectedTags,
      favorite: item?.favorite ?? false,
      color: item && item.kind === kind ? item.color : meta.color,
      createdAt: item?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function toggleTag(id: string) {
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((tag) => tag !== id) : [...current, id]
    );
  }

  const heading = item
    ? `Edit ${meta.title.toLowerCase()}`
    : step === "kind"
      ? "Add to vault"
      : `New ${meta.title.toLowerCase()}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-otto-bg">
      <header className="flex shrink-0 items-center justify-between border-b border-otto-divider px-3 py-3">
        <button
          type="button"
          onClick={step === "form" && !item ? () => setStep("kind") : onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Back"
        >
          {step === "form" && !item ? <ArrowLeft size={18} /> : <X size={18} />}
        </button>
        <b className="text-[15px] font-bold">{heading}</b>
        <span className="w-9" />
      </header>

      <div className="mx-auto w-full max-w-[720px] flex-1 overflow-y-auto px-[18px] py-4 pb-8">
        {step === "kind" ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              What are you saving?
            </p>
            <h1 className="mb-4 text-[24px] font-extrabold">Choose an item type</h1>
            {kindGroups.map((group) => (
              <div key={group.title} className="mb-5">
                <p className="mb-2 text-[12px] font-semibold text-otto-text-dim">
                  {group.title}
                </p>
                <div className="flex flex-col gap-1.5">
                  {group.kinds.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setKind(option.value);
                        setStep("form");
                      }}
                      className="flex w-full items-center gap-3 rounded-xl bg-otto-surface px-3 py-3 text-left"
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: option.color }}
                      >
                        <option.icon size={20} />
                      </span>
                      <span className="flex-1 font-semibold">{option.title}</span>
                      <ChevronRight size={18} className="text-otto-text-faint" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundColor: item && item.kind === kind ? item.color : meta.color,
              }}
            >
              <KindIcon size={28} />
            </div>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                Category
              </span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as VaultKind)}
                className="w-full rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 text-[15px]"
              >
                {kindGroups.flatMap((group) =>
                  group.kinds.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.title}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                Title
              </span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={kind === "login" ? "e.g. Streaming service" : "Give it a name"}
                className="rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 !text-[15px]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                {meta.detailLabel}
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={meta.detailPlaceholder}
                className="rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 !text-[15px]"
              />
            </label>

            {meta.secretLabel && (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                  {meta.secretLabel}
                </span>
                <div className="flex items-center rounded-[10px] border border-otto-divider bg-otto-surface pr-2">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={`Enter ${meta.secretLabel.toLowerCase()}`}
                    className="!border-0 px-3 py-2.5 !text-[15px]"
                  />
                  <button type="button" onClick={() => setShow(!show)} className="px-2">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                Website
              </span>
              <input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="example.com"
                inputMode="url"
                className="rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 !text-[15px]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                Notes
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything worth remembering"
                rows={3}
                className="w-full resize-none rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 text-[15px]"
              />
            </label>

            <div className="rounded-xl bg-otto-surface p-3">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setPickingTags((open) => !open)}
              >
                <span className="flex-1 text-[13px] font-semibold">Tags</span>
                <small className="text-otto-text-dim">
                  {chosen.length ? `${chosen.length} selected` : "None"}
                </small>
                <ChevronDown
                  size={18}
                  className={`text-otto-text-faint transition ${pickingTags ? "rotate-180" : ""}`}
                />
              </button>
              {chosen.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {chosen.map((tag) => (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-otto-divider bg-otto-bg px-2.5 py-1 text-[12px] font-medium"
                    >
                      <i
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                      <X size={12} />
                    </button>
                  ))}
                </div>
              )}
              {pickingTags && (
                <>
                  {tags.length > 8 && (
                    <input
                      value={tagQuery}
                      onChange={(event) => setTagQuery(event.target.value)}
                      placeholder="Search tags"
                      className="mt-3 rounded-[10px] border border-otto-divider bg-otto-bg px-3 py-2 !text-[14px]"
                    />
                  )}
                  <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {available.map((tag) => (
                      <button
                        type="button"
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                          selectedTags.includes(tag.id)
                            ? "bg-otto-text text-otto-bg"
                            : "border border-otto-divider bg-otto-bg"
                        }`}
                      >
                        <i
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))}
                    {!available.length && (
                      <p className="text-[12px] text-otto-text-dim">
                        {tags.length ? "No matching tags" : "Create tags in Settings first."}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-otto-green py-3 text-[14px] font-bold text-black disabled:opacity-40"
            >
              <ShieldCheck size={18} />
              {item ? "Save changes" : "Save to local vault"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
