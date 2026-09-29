import type { SupabaseClient } from "@supabase/supabase-js";
import { BILL_CATEGORIES, type Bill, type BillCategory, type BillInput } from "@/types/bill";

type Row = {
  id: string;
  name: string;
  amount: number | null;
  due_day: number;
  category: string;
  paid_month: string | null;
};

function category(value: string): BillCategory {
  return BILL_CATEGORIES.includes(value as BillCategory) ? (value as BillCategory) : "other";
}

function mapRow(row: Row): Bill {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount == null ? null : Number(row.amount),
    dueDay: row.due_day,
    category: category(row.category),
    paidMonth: row.paid_month,
  };
}

export function createSupabaseBillRepository(client: SupabaseClient, userId: string) {
  return {
    async list(): Promise<Bill[]> {
      const { data, error } = await client
        .from("lf_bills")
        .select("id,name,amount,due_day,category,paid_month")
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
        due_day: Math.min(31, Math.max(1, Math.round(input.dueDay))),
        category: input.category,
        paid_month: input.paidMonth ?? null,
      };
      const query = id
        ? client.from("lf_bills").update(body).eq("id", id).eq("user_id", userId)
        : client.from("lf_bills").insert({ ...body, user_id: userId });
      const { data, error } = await query
        .select("id,name,amount,due_day,category,paid_month")
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
