import { describe, expect, it } from "vitest";
import { asDate, ottoSheets, parseBankSheets, planBankImport } from "@/lib/banksTransfer";
import type { BankAccount, BankDeposit } from "@/types/bank";

const account: BankAccount = {
  id: "a",
  country: "us",
  kind: "checking",
  institution: "Credit union",
  nickname: "",
  owner: "Alex",
  currency: "USD",
  balance: 100,
  last4: "6789",
  nominee: "",
  notes: "",
};

const deposit: BankDeposit = {
  id: "d",
  country: "in",
  kind: "fd",
  institution: "State bank",
  nickname: "",
  owner: "",
  currency: "INR",
  principal: 8000,
  rate: 7.1,
  payout: "maturity",
  startedOn: "2026-01-15",
  maturesOn: "2027-01-15",
  renew: "close",
  nominee: "",
  notes: "",
  closed: false,
};

describe("bank transfer", () => {
  it("reads an exported workbook back into the same rows", () => {
    const parsed = parseBankSheets(ottoSheets([account], [deposit]));
    expect(parsed.accounts[0]).toMatchObject({ institution: "Credit union", balance: 100, last4: "6789", currency: "USD" });
    expect(parsed.deposits[0]).toMatchObject({ institution: "State bank", principal: 8000, rate: 7.1, startedOn: "2026-01-15" });
    expect(parsed.skipped).toEqual([]);
  });

  it("reads a household banks sheet and keeps only the last 4", () => {
    const parsed = parseBankSheets([
      {
        name: "Banks",
        rows: [
          ["Status", "Updated On", "Source", "Amount", "Age since Updated", "Type", "Currency", "Next Action", "", "Account Owner", "Nominee", "Online", "ROI", "Limits", "Account Number"],
          ["", "", "Credit union", 250, "", "Checking", "USD", "", "", "Alex", "", "", "", "", "123456789"],
          ["", "", "State bank", 8000, "", "FD", "INR", "", "", "", "", "", 0.071, "", ""],
        ],
      },
      {
        name: "Bills",
        rows: [
          ["Type", "Amount"],
          ["Water", 40],
        ],
      },
    ]);
    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.accounts[0].last4).toBe("6789");
    expect(parsed.accounts[0].balance).toBe(250);
    expect(parsed.deposits[0]).toMatchObject({ kind: "fd", principal: 8000, rate: 7.1, currency: "INR" });
    expect(parsed.accounts.some((item) => item.institution === "Water")).toBe(false);
  });

  it("reads deposit and post office sheets without using the maturity amount", () => {
    const serial = (Date.UTC(2026, 0, 15) - Date.UTC(1899, 11, 30)) / 86400000;
    const parsed = parseBankSheets([
      {
        name: "Deposits",
        rows: [
          ["Bank", "Type", "Start Date", "Deposit", "Currency", "ROI", "Maturity Amount", "Maturity Date"],
          ["State bank", "SCSS", serial, 5000, "INR", 8.2, 9000, "2027-01-15"],
        ],
      },
      {
        name: "PO",
        rows: [
          ["Owner", "Interest", "Start date", "Maturity", "Balance Ampount", "Account Number"],
          ["Alex", 7.4, "2026-02-01", "2028-02-01", 1200, "9988"],
        ],
      },
    ]);
    expect(parsed.deposits.map((item) => item.kind)).toEqual(["scss", "po"]);
    expect(parsed.deposits[0].principal).toBe(5000);
    expect(parsed.deposits[0].payout).toBe("quarterly");
    expect(asDate(serial)).toBe("2026-01-15");
    expect(parsed.deposits[1]).toMatchObject({ institution: "Post office", principal: 1200, owner: "Alex" });
  });

  it("explains skipped rows and which saved rows would update", () => {
    const parsed = parseBankSheets([
      {
        name: "Banks",
        rows: [
          ["Source", "Amount", "Type", "Currency"],
          ["Credit union", 250, "Checking", "USD"],
          ["State bank", "", "FD", "INR"],
          ["Broker", 40, "Stock grant", "USD"],
        ],
      },
    ]);
    expect(parsed.accounts.some((item) => item.kind === "trading" && item.institution === "Broker")).toBe(true);
    expect(parsed.skipped.map((row) => row.reason)).toEqual(["No amount"]);
    const plan = planBankImport(parsed, [{ ...account, last4: "" }], []);
    expect(plan.updated.map((row) => row.label)).toEqual(["Credit union · Checking · USD"]);
    expect(plan.updated[0].detail).toContain("Balance");
    expect(plan.created.map((row) => row.label)).toEqual(["Broker · Trading · USD"]);
  });

  it("reads household deposit names and every funded deposits-sheet row as a deposit", () => {
    const parsed = parseBankSheets([
      {
        name: "Banks",
        rows: [
          ["Source", "Amount", "Type", "Currency"],
          ["Post office", 500, "Sukanya", "INR"],
          ["Employer", 800, "PF-Pension", "INR"],
          ["Credit union", 200, "Deposit", "USD"],
        ],
      },
      {
        name: "Deposits",
        rows: [
          ["Bank", "Type", "Deposit", "Currency"],
          ["Post office", "PO-PF", 1200, "INR"],
          ["State bank", "Standard FD", 3000, "INR"],
          ["Branch", "", 400, "INR"],
          ["Old", "Paid by Employer", "", "INR"],
        ],
      },
    ]);
    expect(parsed.deposits.map((item) => [item.nickname || item.institution, item.kind])).toEqual([
      ["Sukanya", "other"],
      ["PF-Pension", "other"],
      ["Credit union", "other"],
      ["PO-PF", "other"],
      ["State bank", "fd"],
      ["Branch", "other"],
    ]);
    expect(parsed.skipped.map((row) => row.reason)).toEqual(["No amount"]);
  });
});
