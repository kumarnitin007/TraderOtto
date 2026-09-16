export type NotificationEventKind =
  | "price_range"
  | "position_risk"
  | "near_max"
  | "expiry_soon"
  | "earnings_soon"
  | "assignment_cash_high";

export type NotificationChannel = "browser" | "email" | "discord" | "telegram";

export type EventPreference = {
  enabled: boolean;
  inApp: boolean;
  browser: boolean;
  email: boolean;
  discord: boolean;
  telegram: boolean;
};

export type NotificationPreferences = {
  masterEnabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  expiryDays: number;
  earningsDays: number;
  /** Total short-put assignment backup limit; 0 disables the alert. */
  assignmentCashThreshold: number;
  mutedTickers: string[];
  mutedGroupIds: string[];
  events: Record<NotificationEventKind, EventPreference>;
  discordWebhook: string;
  telegramChatId: string;
  emailAddress: string;
};

export type NotificationSignal = {
  id: string;
  kind: NotificationEventKind;
  status: "open" | "acked" | "expired";
  ticker: string | null;
  tradeId: string | null;
  groupId: string | null;
  firedAt: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "critical";
  dedupeKey: string;
  delivered: Partial<Record<NotificationChannel, boolean>>;
};

export type SignalDraft = Omit<NotificationSignal, "id" | "status" | "firedAt" | "delivered">;
