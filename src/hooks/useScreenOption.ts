"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readScreenOptions,
  SCREEN_OPTION_DEFAULTS,
  writeScreenOptions,
  type ScreenOptions,
} from "@/lib/screenCache";

const SCREEN_OPTIONS_EVENT = "trader-otto:screen-options-changed";

export function useScreenOption<K extends keyof ScreenOptions>(key: K) {
  const [value, setValue] = useState<ScreenOptions[K]>(SCREEN_OPTION_DEFAULTS[key]);

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
      writeScreenOptions({ ...readScreenOptions(), [key]: resolved });
      setValue(resolved);
      window.dispatchEvent(new Event(SCREEN_OPTIONS_EVENT));
    },
    [key]
  );

  return [value, setOption] as const;
}
