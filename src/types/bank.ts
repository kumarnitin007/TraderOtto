export const BANK_COUNTRIES = ["us", "in"] as const;
export type BankCountry = (typeof BANK_COUNTRIES)[number];

export const BANK_CURRENCIES = ["USD", "INR"] as const;
export type BankCurrency = (typeof BANK_CURRENCIES)[number];

export const ACCOUNT_KINDS = ["checking", "savings", "trading", "card", "loan"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const DEPOSIT_KINDS = ["cd", "fd", "rd", "ppf", "scss", "po", "other"] as const;
export type DepositKind = (typeof DEPOSIT_KINDS)[number];

export const DEPOSIT_PAYOUTS = ["maturity", "monthly", "quarterly"] as const;
export type DepositPayout = (typeof DEPOSIT_PAYOUTS)[number];

export const DEPOSIT_RENEWS = ["close", "auto"] as const;
export type DepositRenew = (typeof DEPOSIT_RENEWS)[number];

export type BankAccount = {
  id: string;
  country: BankCountry;
  kind: AccountKind;
  institution: string;
  nickname: string;
  owner: string;
  currency: BankCurrency;
  balance: number;
  last4: string;
  nominee: string;
  notes: string;
};

export type BankAccountInput = Omit<BankAccount, "id">;

export type BankDeposit = {
  id: string;
  country: BankCountry;
  kind: DepositKind;
  institution: string;
  nickname: string;
  owner: string;
  currency: BankCurrency;
  principal: number;
  rate: number | null;
  payout: DepositPayout;
  startedOn: string | null;
  maturesOn: string | null;
  renew: DepositRenew;
  nominee: string;
  notes: string;
  closed: boolean;
};

export type BankDepositInput = Omit<BankDeposit, "id">;

export type BankSnapshot = {
  holdingKind: "account" | "deposit";
  holdingId: string;
  amount: number;
  currency: BankCurrency;
  recordedOn: string;
  createdAt: string;
};
