import type { ClosePayload, NewTrade, Trade } from "@/types/trade";

export interface TradeRepository {
  list(): Promise<Trade[]>;
  add(trade: NewTrade): Promise<Trade>;
  update(id: string, trade: NewTrade): Promise<Trade>;
  close(id: string, closePayload: ClosePayload): Promise<Trade>;
  remove(id: string): Promise<void>;
}
