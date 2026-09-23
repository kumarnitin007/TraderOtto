import type { VaultItem } from "@/lib/vaultRepository";

export type VaultSecuritySnapshot = {
  score: number;
  weakCount: number;
  reusedCount: number;
  label: string;
  detail: string;
};

export function isWeakPassword(password: string): boolean {
  if (password.length < 12) return true;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const kinds = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  return kinds < 3;
}

export function analyzeVaultSecurity(items: VaultItem[]): VaultSecuritySnapshot {
  const withSecrets = items.filter((item) => item.password?.trim());
  const weak = withSecrets.filter((item) => isWeakPassword(item.password!.trim()));
  const byPassword = new Map<string, VaultItem[]>();
  for (const item of withSecrets) {
    const key = item.password!.trim();
    const group = byPassword.get(key) ?? [];
    group.push(item);
    byPassword.set(key, group);
  }
  const reusedGroups = [...byPassword.values()].filter((group) => group.length > 1);
  const reusedCount = reusedGroups.reduce((sum, group) => sum + group.length, 0);

  let score = 100;
  if (!withSecrets.length) {
    score = 100;
  } else {
    score -= Math.min(40, weak.length * 12);
    score -= Math.min(30, reusedGroups.length * 15);
    score = Math.max(0, Math.min(100, score));
  }

  let label = "Excellent";
  if (score < 50) label = "Needs work";
  else if (score < 75) label = "Fair";
  else if (score < 90) label = "Looking good";

  let detail = "Add items to run a checkup.";
  if (withSecrets.length) {
    if (weak.length && reusedGroups.length) {
      detail = `${weak.length} weak and ${reusedGroups.length} reused password groups need attention.`;
    } else if (weak.length) {
      detail =
        weak.length === 1
          ? "1 password needs your attention."
          : `${weak.length} passwords need your attention.`;
    } else if (reusedGroups.length) {
      detail = `${reusedGroups.length} reused password groups detected.`;
    } else {
      detail = "No weak or reused passwords detected.";
    }
  }

  return {
    score,
    weakCount: weak.length,
    reusedCount: reusedGroups.length,
    label,
    detail,
  };
}
