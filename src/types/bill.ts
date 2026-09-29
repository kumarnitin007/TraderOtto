export const BILL_CATEGORIES = [
  "water",
  "electric",
  "credit_card",
  "mortgage",
  "other",
] as const;

export type BillCategory = (typeof BILL_CATEGORIES)[number];

export type Bill = {
  id: string;
  name: string;
  amount: number | null;
  dueDay: number;
  category: BillCategory;
  paidMonth: string | null;
};

export type BillInput = {
  name: string;
  amount: number | null;
  dueDay: number;
  category: BillCategory;
  paidMonth?: string | null;
};
