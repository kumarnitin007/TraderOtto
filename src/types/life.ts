export const LIFE_CATEGORIES = [
  "birthday",
  "anniversary",
  "holiday",
  "special",
  "other",
] as const;

export type LifeCategory = (typeof LIFE_CATEGORIES)[number];

export type LifeRepeat = "yearly" | "once";

export type LifeItem = {
  id: string;
  name: string;
  category: LifeCategory;
  notes: string;
  month: number;
  day: number;
  year: number | null;
  occursOn: string | null;
  repeats: LifeRepeat;
  remindDays: number;
  milestone: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LifeInput = Omit<LifeItem, "id" | "createdAt" | "updatedAt">;

export const EMPTY_LIFE_INPUT: LifeInput = {
  name: "",
  category: "birthday",
  notes: "",
  month: 1,
  day: 1,
  year: null,
  occursOn: null,
  repeats: "yearly",
  remindDays: 3,
  milestone: false,
};
