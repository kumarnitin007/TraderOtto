import type { SupabaseClient } from "@supabase/supabase-js";
import { BILL_CATEGORIES, BILL_FREQUENCIES, type Bill, type BillCategory, type BillFrequency, type BillInput } from "@/types/bill";

const BILL_COLUMNS = "id,name,amount,due_day,due_day_2,due_month,due_set,frequency,category,paid_month";

type Row = {
  id: string;
  name: string;
  amount: number | null;
  due_day: number;
  due_day_2: number | null;
  due_month: number | null;
  due_set: boolean | null;
  frequency: string | null;
  category: string;
  paid_month: string | null;
};

function category(value: string): BillCategory {
  return BILL_CATEGORIES.includes(value as BillCategory) ? (value as BillCategory) : "other";
}

function frequency(value: string | null): BillFrequency {
  return BILL_FREQUENCIES.includes(value as BillFrequency) ? (value as BillFrequency) : "monthly";
}

function mapRow(row: Row): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount == null ? null : Number(row.amount),
    dueDay: row.due_day,
    dueDay2: row.due_day_2,
    dueMonth: row.due_month,
    dueSet: row.due_set !== false,
    frequency: frequency(row.frequency),
    category: category(row.category),
    paidMonth: row.paid_month,
  };
}

export function createSupabaseBillRepository(client: SupabaseClient, userId: string) {
  return {
    async list(): Promise<Bill[]> {
      const { data, error } = await client
        .from("lf_bills")
        .select(BILL_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("due_day");
      if (error) throw new Error(error.message);
      return (data as Row[]).map(mapRow);
    },
    async save(input: BillInput, id?: string): Promise<Bill> {
      const body = {
        name: input.name.trim().slice(0, 80),
        amount: input.amount,
        due_day: Math.min(31, Math.max(1, Math.round(input.dueDay || 1))),
        due_day_2:
          input.frequency === "semimonthly" && input.dueDay2
            ? Math.min(31, Math.max(1, Math.round(input.dueDay2)))
            : null,
        due_month: input.dueMonth ?? null,
        due_set: input.dueSet !== false,
        frequency: input.frequency ?? "monthly",
        category: input.category,
        paid_month: input.paidMonth ?? null,
      };
      const query = id
        ? client.from("lf_bills").update(body).eq("id", id).eq("user_id", userId)
        : client.from("lf_bills").insert({ ...body, user_id: userId });
      const { data, error } = await query
        .select(BILL_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data as Row);
    },
    async remove(id: string): Promise<void> {
      const { error } = await client
        .from("lf_bills")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}
