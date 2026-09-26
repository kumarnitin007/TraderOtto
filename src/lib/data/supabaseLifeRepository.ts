import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifeRepository } from "@/lib/lifeRepository";
import { isLifeCategory } from "@/lib/life";
import type {
  LifeCategory,
  LifeInput,
  LifeItem,
  LifeRepeat,
  LifeTask,
  LifeTaskCadence,
  LifeTaskCheck,
  LifeTaskInput,
} from "@/types/life";

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
    async listTasks() {
      const { data, error } = await client
        .from("lf_tasks")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw new Error(error.message);
      return ((data ?? []) as TaskRow[]).map(mapTask);
    },
    async saveTask(input, id) {
      const body = taskPayload(input);
      const query = id
        ? client.from("lf_tasks").update(body).eq("id", id).eq("user_id", userId)
        : client.from("lf_tasks").insert({ ...body, user_id: userId });
      const { data, error } = await query.select("*").single();
      if (error) throw new Error(error.message);
      return mapTask(data as TaskRow);
    },
    async removeTask(id) {
      const { error } = await client
        .from("lf_tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async listChecks(fromDay) {
      const { data, error } = await client
        .from("lf_task_checks")
        .select("id, task_id, done_on")
        .eq("user_id", userId)
        .gte("done_on", fromDay);
      if (error) throw new Error(error.message);
      return ((data ?? []) as CheckRow[]).map(mapCheck);
    },
    async addCheck(taskId, doneOn) {
      const { data, error } = await client
        .from("lf_task_checks")
        .insert({ user_id: userId, task_id: taskId, done_on: doneOn })
        .select("id, task_id, done_on")
        .single();
      if (error) throw new Error(error.message);
      return mapCheck(data as CheckRow);
    },
    async removeCheck(id) {
      const { error } = await client
        .from("lf_task_checks")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}

type TaskRow = {
  id: string;
  name: string;
  notes: string | null;
  cadence: string;
  target_count: number;
  created_at: string;
  updated_at: string;
};

type CheckRow = {
  id: string;
  task_id: string;
  done_on: string;
};

function mapTask(row: TaskRow): LifeTask {
  const cadence: LifeTaskCadence = row.cadence === "weekly" ? "weekly" : "daily";
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? "",
    cadence,
    targetCount: row.target_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCheck(row: CheckRow): LifeTaskCheck {
  return { id: row.id, taskId: row.task_id, doneOn: row.done_on.slice(0, 10) };
}

function taskPayload(input: LifeTaskInput) {
  const name = clean(input.name, 160);
  if (!name) throw new Error("Enter a name.");
  const cadence: LifeTaskCadence = input.cadence === "weekly" ? "weekly" : "daily";
  return {
    name,
    notes: clean(input.notes, 2000),
    cadence,
    target_count: cadence === "daily" ? 1 : Math.min(7, Math.max(1, input.targetCount)),
  };
}
