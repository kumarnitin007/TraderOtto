import type {
  EventPreference,
  NotificationEventKind,
  NotificationPreferences,
} from "@/types/notification";

export const EVENT_LABELS: Record<
  NotificationEventKind,
  { label: string; description: string }
> = {
  price_range: {
    label: "Price range",
    description: "A watch-list ticker crosses its lower or upper price.",
  },
  position_risk: {
    label: "Position risk",
    description: "An open trade becomes Underwater or Critical.",
  },
  near_max: {
    label: "Near max profit",
    description: "An open trade captures at least 90% of premium.",
  },
  expiry_soon: {
    label: "Expiry soon",
    description: "An open trade is approaching expiration.",
  },
  earnings_soon: {
    label: "Earnings soon",
    description: "A watched company is approaching earnings.",
  },
};

const event = (enabled = true): EventPreference => ({
  enabled,
  inApp: true,
  browser: false,
  email: false,
  discord: false,
  telegram: false,
});

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  masterEnabled: true,
  quietHours: { enabled: false, start: "20:00", end: "09:00" },
  expiryDays: 3,
  earningsDays: 7,
  mutedTickers: [],
  mutedGroupIds: [],
  events: {
    price_range: event(),
    position_risk: event(),
    near_max: event(),
    expiry_soon: event(),
    earnings_soon: event(),
  },
  discordWebhook: "",
  telegramChatId: "",
  emailAddress: "",
};

export function mergeNotificationPreferences(
  value: unknown,
  fallbackEmail = ""
): NotificationPreferences {
  const input =
    value && typeof value === "object"
      ? (value as Partial<NotificationPreferences>)
      : {};
  const inputEvents: Partial<
    Record<NotificationEventKind, Partial<EventPreference>>
  > =
    input.events && typeof input.events === "object" ? input.events : {};
  const events = Object.fromEntries(
    (Object.keys(EVENT_LABELS) as NotificationEventKind[]).map((kind) => {
      const candidate = inputEvents[kind];
      return [
        kind,
        {
          ...DEFAULT_NOTIFICATION_PREFERENCES.events[kind],
          ...(candidate ?? {}),
        },
      ];
    })
  ) as NotificationPreferences["events"];

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...input,
    quietHours: {
      ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
      ...(input.quietHours ?? {}),
    },
    events,
    mutedTickers: Array.isArray(input.mutedTickers)
      ? input.mutedTickers.filter((ticker): ticker is string => typeof ticker === "string")
      : [],
    mutedGroupIds: Array.isArray(input.mutedGroupIds)
      ? input.mutedGroupIds.filter((id): id is string => typeof id === "string")
      : [],
    emailAddress: input.emailAddress || fallbackEmail,
  };
}
