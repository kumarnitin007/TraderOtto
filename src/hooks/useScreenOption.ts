"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readScreenOptions,
  SCREEN_OPTION_DEFAULTS,
  writeScreenOptions,
  type ScreenOptions,
} from "@/lib/screenCache";

export function useScreenOption<K extends keyof ScreenOptions>(key: K) {
  const [value, setValue] = useState<ScreenOptions[K]>(SCREEN_OPTION_DEFAULTS[key]);

  useEffect(() => {
    setValue(readScreenOptions()[key]);
  }, [key]);

  const setOption = useCallback(
    (next: ScreenOptions[K] | ((current: ScreenOptions[K]) => ScreenOptions[K])) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        writeScreenOptions({ ...readScreenOptions(), [key]: resolved });
        return resolved;
      });
    },
    [key]
  );

  return [value, setOption] as const;
}
