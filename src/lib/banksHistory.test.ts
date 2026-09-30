import { describe, expect, it } from "vitest";
import { balanceChanges, dailySeries, growthSinceStart } from "@/lib/banksHistory";
import type { BankAccount, BankDeposit, BankSnapshot } from "@/types/bank";

function account(balance: number): BankAccount {
  return {
    id: "a",
    country: "us",
    kind: "checking",
    institution: "Bank",
    nickname: "",
    owner: "",
    currency: "USD",
    balance,
    last4: "",
    nominee: "",
    notes: "",
  };
}

function deposit(): BankDeposit {
  return {
    id: "d",
    country: "us",
    kind: "fd",
    institution: "Bank",
    nickname: "",
    owner: "",
    currency: "USD",
    principal: 50,
    rate: 4,
    payout: "maturity",
    startedOn: null,
    maturesOn: null,
    renew: "close",
    nominee: "",
    notes: "",
    closed: false,
  };
}

function shot(patch: Partial<BankSnapshot>): BankSnapshot {
  return {
    holdingKind: "account",
    holdingId: "a",
    amount: 100,
    currency: "USD",
    recordedOn: "2026-09-01",
    createdAt: "2026-09-01T00:00:00Z",
    ...patch,
  };
}

describe("bank history", () => {
  it("counts a same-day balance change and plots one point per day", () => {
    const snapshots = [
      shot({ amount: 100, createdAt: "2026-09-29T01:00:00Z" }),
      shot({ amount: 130, createdAt: "2026-09-29T02:00:00Z" }),
      shot({ holdingKind: "deposit", holdingId: "d", amount: 50 }),
    ];
    const growth = growthSinceStart(snapshots, [account(130)], [deposit()], "USD", null);
    expect(growth.change).toBe(30);
    expect(dailySeries(snapshots, [account(130)], [deposit()], "USD", null)).toEqual([{ date: "2026-09-01", total: 180 }]);
    expect(balanceChanges(snapshots, [account(130)], [deposit()])[0]).toMatchObject({ before: 100, after: 130 });
  });
});
