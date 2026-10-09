import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACCOUNT_KINDS,
  BANK_COUNTRIES,
  BANK_CURRENCIES,
  DEPOSIT_KINDS,
  DEPOSIT_PAYOUTS,
  DEPOSIT_RENEWS,
  type AccountKind,
  type BankAccount,
  type BankAccountInput,
  type BankCountry,
  type BankCurrency,
  type BankDeposit,
  type BankDepositInput,
  type DepositKind,
  type DepositPayout,
  type BankSnapshot,
  type DepositRenew,
} from "@/types/bank";

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function mapAccount(row: Record<string, unknown>): BankAccount {
  return {
    id: String(row.id),
    country: oneOf(String(row.country), BANK_COUNTRIES, "us"),
    kind: oneOf(String(row.kind), ACCOUNT_KINDS, "checking") as AccountKind,
    institution: String(row.institution ?? ""),
    nickname: String(row.nickname ?? ""),
    owner: String(row.owner_name ?? ""),
    currency: oneOf(String(row.currency), BANK_CURRENCIES, "USD") as BankCurrency,
    balance: Number(row.balance ?? 0),
    last4: String(row.last4 ?? ""),
    accountNumber: String(row.account_number ?? ""),
    routing: String(row.routing ?? ""),
    nominee: String(row.nominee ?? ""),
    notes: String(row.notes ?? ""),
  };
}

function mapDeposit(row: Record<string, unknown>): BankDeposit {
  return {
    id: String(row.id),
    country: oneOf(String(row.country), BANK_COUNTRIES, "in") as BankCountry,
    kind: oneOf(String(row.kind), DEPOSIT_KINDS, "fd") as DepositKind,
    institution: String(row.institution ?? ""),
    nickname: String(row.nickname ?? ""),
    owner: String(row.owner_name ?? ""),
    currency: oneOf(String(row.currency), BANK_CURRENCIES, "INR") as BankCurrency,
    principal: Number(row.principal ?? 0),
    rate: row.rate == null ? null : Number(row.rate),
    payout: oneOf(String(row.payout), DEPOSIT_PAYOUTS, "quarterly") as DepositPayout,
    startedOn: row.started_on ? String(row.started_on) : null,
    maturesOn: row.matures_on ? String(row.matures_on) : null,
    renew: oneOf(String(row.renew), DEPOSIT_RENEWS, "close") as DepositRenew,
    nominee: String(row.nominee ?? ""),
    notes: String(row.notes ?? ""),
    closed: Boolean(row.closed),
  };
}

const ACCOUNT_COLUMNS = "id,country,kind,institution,nickname,owner_name,currency,balance,last4,nominee,notes";
const ACCOUNT_INFO_COLUMNS = "id,country,kind,institution,nickname,owner_name,currency,balance,last4,nominee,notes,account_number,routing";

function missingAccountColumns(message: string) {
  return /account_number|routing/i.test(message);
}

function accountBody(input: BankAccountInput, withInfo: boolean) {
  const number = input.accountNumber.replace(/[^0-9a-zA-Z]/g, "").slice(0, 34);
  const body: Record<string, unknown> = {
    country: input.country,
    kind: input.kind,
    institution: input.institution.trim().slice(0, 80),
    nickname: input.nickname.trim().slice(0, 80),
    owner_name: input.owner.trim().slice(0, 80),
    currency: input.currency,
    balance: input.balance,
    last4: (number || input.last4).replace(/\D/g, "").slice(-4),
    nominee: input.nominee.trim().slice(0, 80),
    notes: input.notes.trim().slice(0, 500),
  };
  if (withInfo) {
    body.account_number = number;
    body.routing = input.routing.replace(/[^0-9a-zA-Z]/g, "").toUpperCase().slice(0, 11);
  }
  return body;
}

function writeAccount(client: SupabaseClient, userId: string, input: BankAccountInput, id: string | undefined, withInfo: boolean) {
  const body = accountBody(input, withInfo);
  const query = id
    ? client.from("nw_accounts").update(body).eq("id", id).eq("user_id", userId)
    : client.from("nw_accounts").insert({ ...body, user_id: userId });
  return withInfo
    ? query.select(ACCOUNT_INFO_COLUMNS).single()
    : query.select(ACCOUNT_COLUMNS).single();
}

function depositBody(input: BankDepositInput) {
  return {
    country: input.country,
    kind: input.kind,
    institution: input.institution.trim().slice(0, 80),
    nickname: input.nickname.trim().slice(0, 80),
    owner_name: input.owner.trim().slice(0, 80),
    currency: input.currency,
    principal: input.principal,
    rate: input.rate,
    payout: input.payout,
    started_on: input.startedOn,
    matures_on: input.maturesOn,
    renew: input.renew,
    nominee: input.nominee.trim().slice(0, 80),
    notes: input.notes.trim().slice(0, 500),
    closed: input.closed,
  };
}

export function createSupabaseBankRepository(client: SupabaseClient, userId: string) {
  return {
    async listAccounts(): Promise<BankAccount[]> {
      const listed = await client
        .from("nw_accounts")
        .select(ACCOUNT_INFO_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("institution");
      if (!listed.error) return (listed.data as Record<string, unknown>[]).map(mapAccount);
      if (!missingAccountColumns(listed.error.message)) throw new Error(listed.error.message);
      const fallback = await client
        .from("nw_accounts")
        .select(ACCOUNT_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("institution");
      if (fallback.error) throw new Error(fallback.error.message);
      return (fallback.data as Record<string, unknown>[]).map(mapAccount);
    },
    async saveAccount(input: BankAccountInput, id?: string): Promise<BankAccount> {
      const saved = await writeAccount(client, userId, input, id, true);
      if (!saved.error) return mapAccount(saved.data as Record<string, unknown>);
      if (!missingAccountColumns(saved.error.message) || input.accountNumber.trim() || input.routing.trim()) {
        throw new Error(
          missingAccountColumns(saved.error.message)
            ? "Run the Banks account info script in Supabase, then save the account number again."
            : saved.error.message
        );
      }
      const fallback = await writeAccount(client, userId, input, id, false);
      if (fallback.error) throw new Error(fallback.error.message);
      return mapAccount(fallback.data as Record<string, unknown>);
    },
    async removeAccount(id: string): Promise<void> {
      const { error } = await client
        .from("nw_accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async listDeposits(): Promise<BankDeposit[]> {
      const { data, error } = await client
        .from("nw_deposits")
        .select("id,country,kind,institution,nickname,owner_name,currency,principal,rate,payout,started_on,matures_on,renew,nominee,notes,closed")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("matures_on");
      if (error) throw new Error(error.message);
      return (data as Record<string, unknown>[]).map(mapDeposit);
    },
    async saveDeposit(input: BankDepositInput, id?: string): Promise<BankDeposit> {
      const body = depositBody(input);
      const query = id
        ? client.from("nw_deposits").update(body).eq("id", id).eq("user_id", userId)
        : client.from("nw_deposits").insert({ ...body, user_id: userId });
      const { data, error } = await query
        .select("id,country,kind,institution,nickname,owner_name,currency,principal,rate,payout,started_on,matures_on,renew,nominee,notes,closed")
        .single();
      if (error) throw new Error(error.message);
      return mapDeposit(data as Record<string, unknown>);
    },
    async removeDeposit(id: string): Promise<void> {
      const { error } = await client
        .from("nw_deposits")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async listSnapshots(): Promise<BankSnapshot[]> {
      const { data, error } = await client
        .from("nw_snapshots")
        .select("holding_kind,holding_id,amount,currency,recorded_on,created_at")
        .eq("user_id", userId)
        .order("recorded_on");
      if (error) throw new Error(error.message);
      return (data as Record<string, unknown>[]).map((row) => ({
        holdingKind: row.holding_kind === "deposit" ? "deposit" : "account",
        holdingId: String(row.holding_id),
        amount: Number(row.amount ?? 0),
        currency: String(row.currency) === "INR" ? "INR" : "USD",
        recordedOn: String(row.recorded_on).slice(0, 10),
        createdAt: String(row.created_at ?? ""),
      }));
    },
    async clearAll(): Promise<void> {
      const deletedAt = new Date().toISOString();
      const accounts = await client.from("nw_accounts").update({ deleted_at: deletedAt }).eq("user_id", userId).is("deleted_at", null);
      if (accounts.error) throw new Error(accounts.error.message);
      const deposits = await client.from("nw_deposits").update({ deleted_at: deletedAt }).eq("user_id", userId).is("deleted_at", null);
      if (deposits.error) throw new Error(deposits.error.message);
      const snapshots = await client.from("nw_snapshots").delete().eq("user_id", userId);
      if (snapshots.error && !/nw_snapshots|schema cache/i.test(snapshots.error.message)) throw new Error(snapshots.error.message);
    },
    async addSnapshots(rows: Omit<BankSnapshot, "createdAt">[]): Promise<void> {
      if (!rows.length) return;
      const { error } = await client.from("nw_snapshots").insert(
        rows.map((row) => ({
          user_id: userId,
          holding_kind: row.holdingKind,
          holding_id: row.holdingId,
          amount: row.amount,
          currency: row.currency,
          recorded_on: row.recordedOn,
        }))
      );
      if (error) throw new Error(error.message);
    },
  };
}
