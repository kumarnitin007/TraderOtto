"use client";

import { APP_WORKSPACE_META, type AppWorkspace } from "@/lib/appWorkspace";

export function WorkspacePlaceholder({ workspace }: { workspace: AppWorkspace }) {
  const meta = APP_WORKSPACE_META[workspace];
  const Icon = meta.icon;
  return (
    <div className="mx-auto max-w-[520px] py-10">
      <div className="rounded-2xl bg-otto-surface px-5 py-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-otto-bg">
          <Icon size={20} className="text-otto-green" />
        </div>
        <h2 className="mt-4 text-xl font-extrabold">{meta.product}</h2>
        <p className="mt-2 text-sm leading-relaxed text-otto-text-dim">
          {meta.tagline}. Theme, type, and icon style stay with Otto. This
          workspace is a shell until its screens are wired in.
        </p>
      </div>
    </div>
  );
}
