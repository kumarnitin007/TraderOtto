export const BILL_CATEGORIES = [
  "water",
  "electric",
  "credit_card",
  "mortgage",
  "other",
] as const;

export type BillCategory = (typeof BILL_CATEGORIES)[number];

export const BILL_FREQUENCIES = ["monthly", "semimonthly", "bimonthly", "yearly"] as const;

export type BillFrequency = (typeof BILL_FREQUENCIES)[number];

export type Bill = {
  id: string;
  name: string;
  amount: number | null;
  dueDay: number;
  dueDay2: number | null;
  dueMonth: number | null;
  dueSet: boolean;
  frequency: BillFrequency;
  category: BillCategory;
  paidMonth: string | null;
};

export type BillInput = {
  name: string;
  amount: number | null;
  dueDay: number;
  dueDay2?: number | null;
  dueMonth?: number | null;
  dueSet?: boolean;
  frequency?: BillFrequency;
  category: BillCategory;
  paidMonth?: string | null;
};
