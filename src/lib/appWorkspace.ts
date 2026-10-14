import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarHeart,
  Grid2X2,
  KeyRound,
  Landmark,
  LineChart,
  NotebookPen,
} from "lucide-react";

export const APP_WORKSPACES = [
  "trader",
  "vault",
  "books",
  "journal",
  "life",
  "banks",
  "screens",
] as const;

export type AppWorkspace = (typeof APP_WORKSPACES)[number];

export type AppWorkspaceMeta = {
  id: AppWorkspace;
  label: string;
  product: string;
  tagline: string;
  icon: LucideIcon;
};

export const APP_WORKSPACE_META: Record<AppWorkspace, AppWorkspaceMeta> = {
  trader: {
    id: "trader",
    label: "Trader",
    product: "Trader Otto",
    tagline: "Options trade journal",
    icon: LineChart,
  },
  vault: {
    id: "vault",
    label: "Vault",
    product: "Otto Vault",
    tagline: "Password manager",
    icon: KeyRound,
  },
  books: {
    id: "books",
    label: "Books",
    product: "Otto Books",
    tagline: "Personal reading library",
    icon: BookOpen,
  },
  journal: {
    id: "journal",
    label: "Journal",
    product: "Otto Journal",
    tagline: "Private writing",
    icon: NotebookPen,
  },
  life: {
    id: "life",
    label: "Life",
    product: "Otto Life",
    tagline: "Dates that matter",
    icon: CalendarHeart,
  },
  banks: {
    id: "banks",
    label: "Banks",
    product: "Otto Banks",
    tagline: "Accounts and deposits",
    icon: Landmark,
  },
  screens: {
    id: "screens",
    label: "User Screens",
    product: "User Screens",
    tagline: "Build your own trackers",
    icon: Grid2X2,
  },
};

export function isAppWorkspace(value: unknown): value is AppWorkspace {
  return (
    value === "trader" ||
    value === "vault" ||
    value === "books" ||
    value === "journal" ||
    value === "life" ||
    value === "banks" ||
    value === "screens"
  );
}
