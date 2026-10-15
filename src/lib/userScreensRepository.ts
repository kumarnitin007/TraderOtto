import type {
  UserScreen,
  UserScreenInput,
  UserScreenRow,
  UserScreenRowData,
} from "@/types/userScreens";

export class UserScreensError extends Error {
  constructor(
    public code: "LIST_LIMIT_REACHED" | "ROW_LIMIT_REACHED" | "INVALID_DATA",
    message: string,
  ) {
    super(message);
  }
}

export interface UserScreensRepository {
  getLists(): Promise<UserScreen[]>;
  createList(input: UserScreenInput): Promise<UserScreen>;
  updateList(id: string, input: UserScreenInput): Promise<UserScreen>;
  deleteList(id: string): Promise<void>;
  getRows(listId: string): Promise<UserScreenRow[]>;
  addRows(listId: string, rows: UserScreenRowData[]): Promise<UserScreenRow[]>;
  updateRow(rowId: string, data: UserScreenRowData): Promise<UserScreenRow>;
  deleteRow(rowId: string): Promise<void>;
  deleteRows(listId: string): Promise<void>;
}

export function friendlyUserScreensError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/LIST_LIMIT_REACHED/.test(message)) {
    return new UserScreensError("LIST_LIMIT_REACHED", "You can create up to four User Screens.");
  }
  if (/ROW_LIMIT_REACHED/.test(message)) {
    return new UserScreensError("ROW_LIMIT_REACHED", "This screen has reached its 5,000-row limit.");
  }
  if (/us_custom_lists|us_custom_list_rows|schema cache|relation/i.test(message)) {
    return new UserScreensError(
      "INVALID_DATA",
      "Run Design/supabase/user-screens-schema.sql in Supabase, then reload.",
    );
  }
  return cause instanceof Error ? cause : new Error(message || "User Screens could not be updated.");
}
