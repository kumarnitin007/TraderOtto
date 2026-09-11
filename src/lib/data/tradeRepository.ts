import type { ClosePayload, NewTrade, Trade, TradeUpdate } from "@/types/trade";

export interface TradeRepository {
  list(): Promise<Trade[]>;
  add(trade: NewTrade): Promise<Trade>;
  update(id: string, trade: TradeUpdate): Promise<Trade>;
  close(id: string, closePayload: ClosePayload): Promise<Trade>;
  remove(id: string): Promise<void>;
}
