"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readScreenOptions,
  SCREEN_OPTION_DEFAULTS,
  SCREEN_OPTIONS_EVENT,
  updateScreenOptions,
  type ScreenOptions,
} from "@/lib/screenCache";

export function useScreenOption<K extends keyof ScreenOptions>(key: K) {
  const [value, setValue] = useState<ScreenOptions[K]>(() =>
    typeof window === "undefined" ? SCREEN_OPTION_DEFAULTS[key] : readScreenOptions()[key]
  );

  useEffect(() => {
    const sync = () => setValue(readScreenOptions()[key]);
    sync();
    window.addEventListener(SCREEN_OPTIONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SCREEN_OPTIONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  const setOption = useCallback(
    (next: ScreenOptions[K] | ((current: ScreenOptions[K]) => ScreenOptions[K])) => {
      const current = readScreenOptions()[key];
      const resolved = typeof next === "function" ? next(current) : next;
      updateScreenOptions({ [key]: resolved });
      setValue(resolved);
    },
    [key]
  );

  return [value, setOption] as const;
}
