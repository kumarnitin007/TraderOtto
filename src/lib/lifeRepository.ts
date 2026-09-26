import type {
  LifeInput,
  LifeItem,
  LifeList,
  LifeListItem,
  LifeListItemInput,
  LifeTask,
  LifeTaskCheck,
  LifeTaskInput,
} from "@/types/life";

export interface LifeRepository {
  list(): Promise<LifeItem[]>;
  save(input: LifeInput, id?: string): Promise<LifeItem>;
  remove(id: string): Promise<void>;
  listTasks(): Promise<LifeTask[]>;
  saveTask(input: LifeTaskInput, id?: string): Promise<LifeTask>;
  removeTask(id: string): Promise<void>;
  listChecks(fromDay: string): Promise<LifeTaskCheck[]>;
  addCheck(taskId: string, doneOn: string): Promise<LifeTaskCheck>;
  removeCheck(id: string): Promise<void>;
  listLists(): Promise<LifeList[]>;
  saveList(name: string, id?: string): Promise<LifeList>;
  removeList(id: string): Promise<void>;
  listListItems(): Promise<LifeListItem[]>;
  saveListItem(input: LifeListItemInput, id?: string): Promise<LifeListItem>;
  removeListItem(id: string): Promise<void>;
}
