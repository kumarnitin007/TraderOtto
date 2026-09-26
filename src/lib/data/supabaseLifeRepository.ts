import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeRepository } from "@/lib/lifeRepository";
import { isLifeCategory } from "@/lib/life";
import type { LifeCategory, LifeInput, LifeItem, LifeRepeat } from "@/types/life";

type LifeRow = {
  id: string;
  name: string;
  category: string;
  notes: string | null;
  month: number;
  day: number;
  year: number | null;
  occurs_on: string | null;
  repeats: string;
  remind_days: number;
  milestone: boolean;
  created_at: string;
  updated_at: string;
};

function clean(value: string, max: number) {
  return value.trim().slice(0, max);
}

function mapLife(row: LifeRow): LifeItem {
  const category: LifeCategory = isLifeCategory(row.category) ? row.category : "other";
  const repeats: LifeRepeat = row.repeats === "once" ? "once" : "yearly";
  return {
    id: row.id,
    name: row.name,
    category,
    notes: row.notes ?? "",
    month: row.month,
    day: row.day,
    year: row.year,
    occursOn: row.occurs_on,
    repeats,
    remindDays: row.remind_days,
    milestone: row.milestone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function payload(input: LifeInput) {
  const name = clean(input.name, 160);
  if (!name) throw new Error("Enter a name.");
  if (!isLifeCategory(input.category)) throw new Error("Choose a category.");
  if (input.month < 1 || input.month > 12 || input.day < 1 || input.day > 31) {
    throw new Error("Enter a real date.");
  }
  return {
    name,
    category: input.category,
    notes: clean(input.notes, 2000),
    month: input.month,
    day: input.day,
    year: input.year,
    occurs_on: input.repeats === "once" ? input.occursOn : null,
    repeats: input.repeats,
    remind_days: Math.min(30, Math.max(0, input.remindDays)),
    milestone: input.milestone,
  };
}

export function createSupabaseLifeRepository(
  client: SupabaseClient,
  userId: string,
): LifeRepository {
  return {
    async list() {
      const { data, error } = await client
        .from("lf_items")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("month")
        .order("day");
      if (error) throw new Error(error.message);
      return ((data ?? []) as LifeRow[]).map(mapLife);
    },
    async save(input, id) {
      const body = payload(input);
      const query = id
        ? client.from("lf_items").update(body).eq("id", id).eq("user_id", userId)
        : client.from("lf_items").insert({ ...body, user_id: userId });
      const { data, error } = await query.select("*").single();
      if (error) throw new Error(error.message);
      return mapLife(data as LifeRow);
    },
    async remove(id) {
      const { error } = await client
        .from("lf_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}
