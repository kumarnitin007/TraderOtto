"use client";

import { useEffect, type ReactNode } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function moveFocus(key: string) {
  const active = document.activeElement as HTMLElement | null;
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
  const candidates = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
  });
  if (!candidates.length) return;
  if (!active || !candidates.includes(active)) {
    candidates[0].focus();
    return;
  }
  const source = active.getBoundingClientRect();
  const sx = source.left + source.width / 2;
  const sy = source.top + source.height / 2;
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  const direction = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
  const target = candidates
    .filter((element) => element !== active)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const primary = vertical ? (y - sy) * direction : (x - sx) * direction;
      const secondary = vertical ? Math.abs(x - sx) : Math.abs(y - sy);
      return { element, primary, score: primary + secondary * 0.35 };
    })
    .filter((entry) => entry.primary > 4)
    .sort((left, right) => left.score - right.score)[0]?.element;
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

export function AndroidBridge({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
      event.preventDefault();
      moveFocus(event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    const back = Capacitor.isNativePlatform()
      ? App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) window.history.back();
          else void App.exitApp();
        })
      : null;
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      void back?.then((handle) => handle.remove());
    };
  }, []);
  return children;
}
