"use client";

import { ChevronDown, LayoutGrid } from "lucide-react";
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

  const home = APP_WORKSPACE_META[defaultSection];

  return (
    <details className="group mb-5 overflow-hidden rounded-2xl bg-otto-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
        <LayoutGrid size={18} className="shrink-0 text-otto-text-dim" />
        <span className="min-w-0 flex-1">
          <b className="block text-[14px]">Sections</b>
          <span className="block text-[12px] text-otto-text-dim">
            {enabledSections.length} visible · {home.label} opens after sign-in
          </span>
        </span>
        <ChevronDown
          size={17}
          className="shrink-0 text-otto-text-faint transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-otto-divider">
        <p className="px-3.5 pb-1 pt-3 text-[12px] leading-relaxed text-otto-text-dim">
          Turn a section off to hide it. Home is the one that opens after you sign in.
        </p>
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
    </details>
  );
}
