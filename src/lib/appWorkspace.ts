import type { LucideIcon } from "lucide-react";
import { KeyRound, NotebookPen, ListTodo, LineChart } from "lucide-react";

export const APP_WORKSPACES = [
  "trader",
  "vault",
  "journal",
  "tasks",
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
  journal: {
    id: "journal",
    label: "Journal",
    product: "Otto Journal",
    tagline: "Private writing",
    icon: NotebookPen,
  },
  tasks: {
    id: "tasks",
    label: "Tasks",
    product: "Otto Tasks",
    tagline: "Personal task manager",
    icon: ListTodo,
  },
};

export function isAppWorkspace(value: unknown): value is AppWorkspace {
  return (
    value === "trader" ||
    value === "vault" ||
    value === "journal" ||
    value === "tasks"
  );
}
