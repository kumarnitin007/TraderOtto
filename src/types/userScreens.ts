export const USER_SCREEN_COLUMN_TYPES = ["text", "number", "date", "check", "auto"] as const;
export type UserScreenColumnType = (typeof USER_SCREEN_COLUMN_TYPES)[number];
export type UserScreenAutoOperator = "+" | "-";

export interface UserScreenColumn {
  id: string;
  label: string;
  type: UserScreenColumnType;
  a?: string;
  op?: UserScreenAutoOperator;
  b?: string;
  incl?: boolean;
  today?: boolean;
}

export interface UserScreenSummary {
  by: string;
  sum: string;
  view?: "bar" | "donut" | "totals";
}

export const USER_SCREEN_ICONS = [
  "grid",
  "plane",
  "wallet",
  "calendar",
  "car",
  "utensils",
  "book",
  "users",
  "briefcase",
  "heart",
  "star",
  "list",
] as const;
export type UserScreenIcon = (typeof USER_SCREEN_ICONS)[number];

export interface UserScreen {
  id: string;
  name: string;
  position: number;
  columns: UserScreenColumn[];
  summaries: UserScreenSummary[];
  icon: UserScreenIcon | "";
  createdAt: string;
  updatedAt: string;
}

export type UserScreenRowData = Record<string, string | boolean>;

export interface UserScreenRow {
  id: string;
  listId: string;
  data: UserScreenRowData;
  createdAt: string;
  updatedAt: string;
}

export type UserScreenInput = Pick<UserScreen, "name" | "columns" | "summaries" | "icon">;

export const USER_SCREEN_LIMIT = 4;
export const USER_SCREEN_ROW_LIMIT = 5000;
export const USER_SCREEN_COLUMN_LIMIT = 20;
export const USER_SCREEN_SUMMARY_LIMIT = 8;
