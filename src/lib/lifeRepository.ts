import type { LifeInput, LifeItem } from "@/types/life";

export interface LifeRepository {
  list(): Promise<LifeItem[]>;
  save(input: LifeInput, id?: string): Promise<LifeItem>;
  remove(id: string): Promise<void>;
}
