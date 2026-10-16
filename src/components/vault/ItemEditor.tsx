"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ImageUp,
  ShieldCheck,
  X,
} from "lucide-react";
import { barcodeChoices } from "@/components/vault/BarcodePanel";
import {
  GIFT_CARD_CATEGORIES,
  parseGiftCardText,
  type GiftCardCategory,
} from "@/lib/giftCardScan";
import { kindGroups, kindMeta } from "@/lib/vaultItemTypes";
import {
  vaultBarcodeFormat,
  type VaultBarcodeFormat,
  type VaultItem,
  type VaultKind,
  type VaultTag,
} from "@/lib/vaultRepository";

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
  const [barcodeEnabled, setBarcodeEnabled] = useState(item?.barcodeEnabled ?? false);
  const [barcodeFormat, setBarcodeFormat] = useState<VaultBarcodeFormat>(
    vaultBarcodeFormat(item?.barcodeFormat)
  );
  const [giftBalance, setGiftBalance] = useState(item?.customFields?.Balance ?? "");
  const [giftCategory, setGiftCategory] = useState<GiftCardCategory>(
    (GIFT_CARD_CATEGORIES.includes(item?.customFields?.["Gift card category"] as GiftCardCategory)
      ? item?.customFields?.["Gift card category"]
      : "Other") as GiftCardCategory
  );
  const [scanProgress, setScanProgress] = useState<number | null>(null);
  const [scanError, setScanError] = useState("");

  const meta = kindMeta(kind);
  const KindIcon = meta.icon;
  const chosen = tags.filter((tag) => selectedTags.includes(tag.id));
  const available = tags.filter((tag) =>
    tag.name.toLowerCase().includes(tagQuery.toLowerCase())
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const customFields = { ...(item?.customFields ?? {}) };
    if (kind === "gift_card") {
      customFields.Balance = giftBalance.trim();
      customFields["Gift card category"] = giftCategory;
    } else {
      delete customFields.Balance;
      delete customFields["Gift card category"];
    }
    const savedCustomFields = Object.keys(customFields).length ? customFields : undefined;
    onSave({
      ...(item ?? {}),
      id: item?.id ?? crypto.randomUUID(),
      kind,
      name: name.trim(),
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      website: website.trim() || undefined,
      note: note.trim() || undefined,
      customFields: savedCustomFields,
      barcodeEnabled: barcodeEnabled && Boolean(username.trim()),
      barcodeFormat: barcodeEnabled ? barcodeFormat : undefined,
      tags: selectedTags,
      favorite: item?.favorite ?? false,
      color: item && item.kind === kind ? item.color : meta.color,
      createdAt: item?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function chooseKind(next: VaultKind) {
    setKind(next);
    if (next === "gift_card" && !item) {
      setBarcodeEnabled(true);
      setBarcodeFormat("CODE128");
    }
  }

  async function scanGiftCard(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setScanError("");
    setScanProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setScanProgress(Math.round(message.progress * 100));
          }
        },
      });
      try {
        const result = parseGiftCardText((await worker.recognize(file)).data.text);
        if (!result.cardNumber && !result.name) {
          setScanError("The card details could not be recognized. Try a straight, well-lit photo.");
          return;
        }
        if (result.name) setName(result.name);
        if (result.cardNumber) setUsername(result.cardNumber);
        if (result.pin) setPassword(result.pin);
        if (result.balance) setGiftBalance(result.balance);
        if (result.website) setWebsite(result.website);
        setGiftCategory(result.category);
        setBarcodeEnabled(Boolean(result.cardNumber));
        setBarcodeFormat("CODE128");
      } finally {
        await worker.terminate();
      }
    } catch (cause) {
      setScanError(cause instanceof Error ? cause.message : "The card image could not be read.");
    } finally {
      setScanProgress(null);
    }
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
                        chooseKind(option.value);
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
                onChange={(event) => chooseKind(event.target.value as VaultKind)}
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

            {kind === "gift_card" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-otto-green px-3 py-3 text-center text-[13px] font-bold text-otto-green">
                    <ImageUp size={18} className="shrink-0" />
                    {scanProgress == null ? "Choose screenshot" : `Reading… ${scanProgress}%`}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={scanProgress != null}
                      onChange={(event) => void scanGiftCard(event)}
                      className="hidden"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-otto-green px-3 py-3 text-center text-[13px] font-bold text-otto-green">
                    <Camera size={18} className="shrink-0" />
                    Take photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={scanProgress != null}
                      onChange={(event) => void scanGiftCard(event)}
                      className="hidden"
                    />
                  </label>
                </div>
                {scanError && (
                  <p className="rounded-xl bg-otto-red-soft px-3 py-2 text-[12px] text-otto-red">
                    {scanError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                      Balance
                    </span>
                    <input
                      value={giftBalance}
                      onChange={(event) => setGiftBalance(event.target.value)}
                      placeholder="$0.00"
                      inputMode="decimal"
                      className="rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 !text-[15px]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                      Gift card category
                    </span>
                    <select
                      value={giftCategory}
                      onChange={(event) => setGiftCategory(event.target.value as GiftCardCategory)}
                      className="rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 text-[15px]"
                    >
                      {GIFT_CARD_CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

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

            <div className="rounded-xl bg-otto-surface p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={barcodeEnabled}
                  disabled={!username.trim()}
                  onChange={(event) => setBarcodeEnabled(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block text-[13px] font-semibold">Enable barcode</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-otto-text-dim">
                    {kind === "wifi"
                      ? "Adds a code for the network name. The Wi-Fi QR still includes the password."
                      : kind === "gift_card"
                        ? "Shows the card number as a scannable code at checkout."
                        : "Adds one code generated on this device from the username."}
                  </span>
                </span>
              </label>
              {barcodeEnabled && username.trim() && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {barcodeChoices(username.trim()).map((choice) => (
                    <button
                      key={choice.format}
                      type="button"
                      aria-pressed={barcodeFormat === choice.format}
                      onClick={() => setBarcodeFormat(choice.format)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                        barcodeFormat === choice.format
                          ? "bg-otto-text text-otto-bg"
                          : "text-otto-text-dim"
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
