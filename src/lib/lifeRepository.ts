import type { LifeInput, LifeItem, LifeTask, LifeTaskCheck, LifeTaskInput } from "@/types/life";

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
}
