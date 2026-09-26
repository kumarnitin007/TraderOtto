"use client";

import { useState } from "react";
import { Clipboard } from "lucide-react";

/** Shows the exact text an AI call sends, so it can be read, checked, or reused by hand. */
export function PromptPreview({
  prompt,
  title = "Manual prompt",
  hint = "Paste into ChatGPT to compare against the built-in call.",
  copied,
  onCopy,
}: {
  prompt: string;
  title?: string;
  hint?: string;
  copied?: boolean;
  onCopy?: (copied: boolean) => void;
}) {
  const [shown, setShown] = useState(false);
  const [localCopied, setLocalCopied] = useState(false);
  const isCopied = copied ?? localCopied;

  if (!prompt) return null;

  return (
    <section className="mt-6 border-t border-otto-divider pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-otto-text-faint">
            {title}
          </h3>
          <div className="mt-1 text-xs text-otto-text-faint">{hint}</div>
        </div>
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          className="shrink-0 rounded-full border border-otto-divider px-3 py-1.5 text-xs font-semibold text-otto-text-dim"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {shown && (
        <>
          <textarea
            readOnly
            value={prompt}
            rows={14}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-3 w-full resize-none font-mono text-[11px] leading-relaxed"
            aria-label={`${title} text`}
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(prompt);
              setLocalCopied(true);
              onCopy?.(true);
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-otto-green px-3.5 py-2 text-xs font-bold text-black"
          >
            <Clipboard size={13} />
            {isCopied ? "Copied" : "Copy prompt"}
          </button>
        </>
      )}
    </section>
  );
}
