import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeNotificationPreferences } from "@/lib/notificationDefaults";
import type {
  NotificationPreferences,
  NotificationSignal,
  SignalDraft,
} from "@/types/notification";

type SignalRow = {
  id: string;
  kind: NotificationSignal["kind"];
  status: NotificationSignal["status"];
  ticker: string | null;
  trade_id: string | null;
  group_id: string | null;
  fired_at: string;
  payload: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
};

function mapSignal(row: SignalRow): NotificationSignal {
  const payload = row.payload ?? {};
  const meta = row.meta ?? {};
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    ticker: row.ticker,
    tradeId: row.trade_id,
    groupId: row.group_id,
    firedAt: row.fired_at,
    title: typeof payload.title === "string" ? payload.title : "Trader Otto alert",
    message: typeof payload.message === "string" ? payload.message : "",
    severity:
      payload.severity === "success" ||
      payload.severity === "warning" ||
      payload.severity === "critical"
        ? payload.severity
        : "info",
    dedupeKey: typeof meta.dedupeKey === "string" ? meta.dedupeKey : row.id,
    delivered:
      meta.delivered && typeof meta.delivered === "object"
        ? (meta.delivered as NotificationSignal["delivered"])
        : {},
  };
}

export function createSupabaseNotificationRepository(
  supabase: SupabaseClient,
  userId: string,
  email: string
) {
  return {
    async loadPreferences() {
      const { data, error } = await supabase
        .from("tr_profiles")
        .select("settings")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        const preferences = mergeNotificationPreferences(null, email);
        const { error: insertError } = await supabase
          .from("tr_profiles")
          .insert({ id: userId, settings: { notifications: preferences } });
        if (insertError) throw new Error(insertError.message);
        return preferences;
      }
      const settings =
        data.settings && typeof data.settings === "object"
          ? (data.settings as Record<string, unknown>)
          : {};
      return mergeNotificationPreferences(settings.notifications, email);
    },

    async savePreferences(preferences: NotificationPreferences) {
      const { data: current, error: readError } = await supabase
        .from("tr_profiles")
        .select("settings")
        .eq("id", userId)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      const settings =
        current?.settings && typeof current.settings === "object"
          ? (current.settings as Record<string, unknown>)
          : {};
      const { error } = await supabase
        .from("tr_profiles")
        .upsert({
          id: userId,
          settings: { ...settings, notifications: preferences },
        });
      if (error) throw new Error(error.message);
    },

    async listSignals() {
      const { data, error } = await supabase
        .from("tr_signals")
        .select("id, kind, status, ticker, trade_id, group_id, fired_at, payload, meta")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("fired_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return ((data ?? []) as SignalRow[]).map(mapSignal);
    },

    async createSignal(draft: SignalDraft) {
      const { data, error } = await supabase
        .from("tr_signals")
        .insert({
          user_id: userId,
          kind: draft.kind,
          ticker: draft.ticker,
          trade_id: draft.tradeId,
          group_id: draft.groupId,
          payload: {
            title: draft.title,
            message: draft.message,
            severity: draft.severity,
          },
          meta: { dedupeKey: draft.dedupeKey, delivered: {} },
        })
        .select("id, kind, status, ticker, trade_id, group_id, fired_at, payload, meta")
        .single();
      if (error) throw new Error(error.message);
      return mapSignal(data as SignalRow);
    },

    async acknowledge(id: string) {
      const { error } = await supabase
        .from("tr_signals")
        .update({ status: "acked" })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },

    async acknowledgeByKey(dedupeKey: string) {
      const { data, error } = await supabase
        .from("tr_signals")
        .select("id, meta")
        .eq("user_id", userId)
        .eq("status", "open");
      if (error) throw new Error(error.message);
      const ids = (data ?? [])
        .filter(
          (row) =>
            row.meta &&
            typeof row.meta === "object" &&
            (row.meta as Record<string, unknown>).dedupeKey === dedupeKey
        )
        .map((row) => row.id);
      if (!ids.length) return;
      const { error: updateError } = await supabase
        .from("tr_signals")
        .update({ status: "acked" })
        .in("id", ids)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);
    },
  };
}

export type NotificationRepository = ReturnType<
  typeof createSupabaseNotificationRepository
>;
