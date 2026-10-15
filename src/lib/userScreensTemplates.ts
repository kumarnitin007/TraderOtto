import { USER_SCREEN_SUMMARY_LIMIT, type UserScreenInput } from "@/types/userScreens";
import { isUserScreenIcon } from "@/lib/userScreensSummaries";

function id() {
  return crypto.randomUUID();
}

export function travelScreenTemplate(): UserScreenInput {
  const person = id();
  const start = id();
  const end = id();
  const total = id();
  return {
    name: "Travel",
    columns: [
      { id: person, label: "Person", type: "text" },
      { id: start, label: "Start date", type: "date" },
      { id: end, label: "End date", type: "date" },
      {
        id: total,
        label: "Total days",
        type: "auto",
        a: end,
        op: "-",
        b: start,
        incl: true,
        today: false,
      },
    ],
    summaries: [{ by: person, sum: total }],
    icon: "plane",
  };
}

export function expenseScreenTemplate(): UserScreenInput {
  const category = id();
  const amount = id();
  const extra = id();
  const total = id();
  return {
    name: "Expenses",
    columns: [
      { id: category, label: "Category", type: "text" },
      { id: amount, label: "Amount", type: "number" },
      { id: extra, label: "Tax and tip", type: "number" },
      { id: total, label: "Total", type: "auto", a: amount, op: "+", b: extra },
    ],
    summaries: [{ by: category, sum: total }],
    icon: "wallet",
  };
}

export function blankScreenTemplate(): UserScreenInput {
  return {
    name: "",
    columns: [{ id: id(), label: "Name", type: "text" }],
    summaries: [],
    icon: "grid",
  };
}

export const USER_SCREEN_TEMPLATES = [
  {
    id: "travel",
    label: "Travel",
    detail: "Count inclusive days by person",
    icon: "plane",
    create: travelScreenTemplate,
  },
  {
    id: "expenses",
    label: "Expenses",
    detail: "Add amounts and summarize by category",
    icon: "wallet",
    create: expenseScreenTemplate,
  },
  {
    id: "blank",
    label: "Blank",
    detail: "Design your own screen",
    icon: "grid",
    create: blankScreenTemplate,
  },
] as const;

export function validateUserScreen(input: UserScreenInput) {
  if (input.icon && !isUserScreenIcon(input.icon)) return "Choose a supported screen icon.";
  if (!input.name.trim()) return "Add a screen name.";
  if (input.name.trim().length > 60) return "Keep the screen name under 60 characters.";
  if (!input.columns.length) return "Add at least one column.";
  if (input.columns.length > 20) return "A screen can have up to 20 columns.";
  const ids = new Set(input.columns.map((column) => column.id));
  if (ids.size !== input.columns.length) return "Column identifiers must be unique.";
  if (input.columns.some((column) => !column.label.trim())) return "Name every column.";
  if (input.columns.some((column) => column.label.trim().length > 40)) {
    return "Keep column names under 40 characters.";
  }
  for (const col of input.columns) {
    if (col.type !== "auto") continue;
    const a = input.columns.find((item) => item.id === col.a);
    const b = input.columns.find((item) => item.id === col.b);
    if (!a || !b || a.id === b.id) return `Finish the formula for ${col.label}.`;
    if (!((a.type === "date" && b.type === "date") || (a.type === "number" && b.type === "number"))) {
      return `Use two date columns or two number columns in ${col.label}.`;
    }
  }
  if (input.summaries.length > USER_SCREEN_SUMMARY_LIMIT) {
    return `A screen can have up to ${USER_SCREEN_SUMMARY_LIMIT} summaries.`;
  }
  const seen = new Set<string>();
  for (const summary of input.summaries) {
    if (summary.view && !["bar", "donut", "totals"].includes(summary.view)) {
      return "Choose a supported overview style for every summary.";
    }
    const by = input.columns.find((column) => column.id === summary.by);
    const sum = input.columns.find((column) => column.id === summary.sum);
    if (!by || by.type !== "text" || !sum || (sum.type !== "number" && sum.type !== "auto")) {
      return "Choose a text column to group by and a number or formula column to total.";
    }
    const key = `${summary.by}:${summary.sum}`;
    if (seen.has(key)) return "Each summary needs its own group and total.";
    seen.add(key);
  }
  return null;
}
