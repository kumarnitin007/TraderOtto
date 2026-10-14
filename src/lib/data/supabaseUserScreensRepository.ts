import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  UserScreen,
  UserScreenColumn,
  UserScreenInput,
  UserScreenRow,
  UserScreenRowData,
  UserScreenSummary,
} from "@/types/userScreens";
import type { UserScreensRepository } from "@/lib/userScreensRepository";
import { friendlyUserScreensError } from "@/lib/userScreensRepository";

type ListRow = {
  id: string;
  name: string;
  position: number;
  columns: UserScreenColumn[];
  summary: UserScreenSummary | null;
  created_at: string;
  updated_at: string;
};

type DataRow = {
  id: string;
  list_id: string;
  data: UserScreenRowData;
  created_at: string;
  updated_at: string;
};

function listFromRow(row: ListRow): UserScreen {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    columns: row.columns,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dataFromRow(row: DataRow): UserScreenRow {
  return {
    id: row.id,
    listId: row.list_id,
    data: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fail(error: { message: string } | null) {
  if (error) throw friendlyUserScreensError(new Error(error.message));
}

export function createSupabaseUserScreensRepository(
  client: SupabaseClient,
  userId: string,
): UserScreensRepository {
  return {
    async getLists() {
      const { data, error } = await client
        .from("us_custom_lists")
        .select("id,name,position,columns,summary,created_at,updated_at")
        .eq("user_id", userId)
        .order("position")
        .order("created_at");
      fail(error);
      return ((data ?? []) as ListRow[]).map(listFromRow);
    },

    async createList(input) {
      const current = await this.getLists();
      const { data, error } = await client
        .from("us_custom_lists")
        .insert({
          user_id: userId,
          name: input.name.trim(),
          position: current.length,
          columns: input.columns,
          summary: input.summary,
        })
        .select("id,name,position,columns,summary,created_at,updated_at")
        .single();
      fail(error);
      return listFromRow(data as ListRow);
    },

    async updateList(id, input) {
      const { data, error } = await client
        .from("us_custom_lists")
        .update({
          name: input.name.trim(),
          columns: input.columns,
          summary: input.summary,
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select("id,name,position,columns,summary,created_at,updated_at")
        .single();
      fail(error);
      return listFromRow(data as ListRow);
    },

    async deleteList(id) {
      const { error } = await client
        .from("us_custom_lists")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      fail(error);
    },

    async getRows(listId) {
      const { data, error } = await client
        .from("us_custom_list_rows")
        .select("id,list_id,data,created_at,updated_at")
        .eq("user_id", userId)
        .eq("list_id", listId)
        .order("created_at");
      fail(error);
      return ((data ?? []) as DataRow[]).map(dataFromRow);
    },

    async addRows(listId, rows) {
      if (!rows.length) return [];
      const saved: UserScreenRow[] = [];
      for (let index = 0; index < rows.length; index += 250) {
        const { data, error } = await client
          .from("us_custom_list_rows")
          .insert(
            rows.slice(index, index + 250).map((row) => ({
              user_id: userId,
              list_id: listId,
              data: row,
            })),
          )
          .select("id,list_id,data,created_at,updated_at");
        fail(error);
        saved.push(...((data ?? []) as DataRow[]).map(dataFromRow));
      }
      return saved;
    },

    async updateRow(rowId, data) {
      const { data: saved, error } = await client
        .from("us_custom_list_rows")
        .update({ data })
        .eq("id", rowId)
        .eq("user_id", userId)
        .select("id,list_id,data,created_at,updated_at")
        .single();
      fail(error);
      return dataFromRow(saved as DataRow);
    },

    async deleteRow(rowId) {
      const { error } = await client
        .from("us_custom_list_rows")
        .delete()
        .eq("id", rowId)
        .eq("user_id", userId);
      fail(error);
    },
  };
}
