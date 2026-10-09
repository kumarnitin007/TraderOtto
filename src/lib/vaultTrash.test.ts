import { describe, expect, it } from "vitest";
import { canRestoreVaultItem, trashTimeLeft, VAULT_TRASH_DAYS } from "@/lib/vaultTrash";

const deletedAt = "2026-10-01T12:00:00.000Z";

describe("vault trash retention", () => {
  it("keeps an item restorable through the 30th day", () => {
    const justDeleted = new Date(deletedAt);
    const lastMoment = new Date(new Date(deletedAt).getTime() + VAULT_TRASH_DAYS * 24 * 60 * 60 * 1000 - 1);
    expect(canRestoreVaultItem(deletedAt, justDeleted)).toBe(true);
    expect(canRestoreVaultItem(deletedAt, lastMoment)).toBe(true);
    expect(trashTimeLeft(deletedAt, justDeleted)).toBe("30 days left");
  });

  it("expires the item once 30 days have passed", () => {
    const expired = new Date(new Date(deletedAt).getTime() + VAULT_TRASH_DAYS * 24 * 60 * 60 * 1000);
    expect(canRestoreVaultItem(deletedAt, expired)).toBe(false);
    expect(trashTimeLeft(deletedAt, expired)).toBe("Expired");
  });
});
