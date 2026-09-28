"use client";

import { useScreenOption } from "@/hooks/useScreenOption";
import { APP_WORKSPACE_META, APP_WORKSPACES, type AppWorkspace } from "@/lib/appWorkspace";
import { updateScreenOptions } from "@/lib/screenCache";
import { withSectionToggled } from "@/lib/sectionPreferences";

export function SectionPreferences() {
  const [enabledSections] = useScreenOption("enabledSections");
  const [defaultSection] = useScreenOption("defaultSection");
  const [workspace] = useScreenOption("appWorkspace");

  function toggle(id: AppWorkspace) {
    updateScreenOptions(
      withSectionToggled(enabledSections, defaultSection, workspace, id)
    );
  }

  function chooseHome(id: AppWorkspace) {
    if (!enabledSections.includes(id)) return;
    updateScreenOptions({ defaultSection: id });
  }

  return (
    <section className="mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Sections
      </p>
      <p className="mb-3 mt-1 text-[13px] leading-relaxed text-otto-text-dim">
        Trader, Vault, Books, Journal, and Life are the sections in Otto&apos;s World.
        Turn one off to hide it. Home is the section that opens after you sign in.
      </p>
      <div className="overflow-hidden rounded-2xl bg-otto-surface">
        {APP_WORKSPACES.map((id, index) => {
          const item = APP_WORKSPACE_META[id];
          const Icon = item.icon;
          const on = enabledSections.includes(id);
          const isHome = defaultSection === id;
          const lastVisible = on && enabledSections.length === 1;
          return (
            <div key={id}>
              {index > 0 && <div className="mx-3.5 border-t border-otto-divider" />}
              <div className="flex items-center gap-3 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={lastVisible}
                  aria-label={`Show ${item.label}`}
                  title={lastVisible ? "At least one section stays on" : undefined}
                  onChange={() => toggle(id)}
                  className="h-4 w-4 accent-otto-green"
                />
                <Icon size={18} className="shrink-0 text-otto-text-dim" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{item.label}</span>
                  <span className="block text-[12px] text-otto-text-faint">{item.tagline}</span>
                </span>
                <button
                  type="button"
                  disabled={!on}
                  aria-pressed={isHome}
                  onClick={() => chooseHome(id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold disabled:opacity-40 ${
                    isHome
                      ? "bg-otto-text text-otto-bg"
                      : "bg-otto-bg text-otto-text-dim"
                  }`}
                >
                  {isHome ? "Home" : "Set home"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
