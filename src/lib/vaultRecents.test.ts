import { describe, expect, it } from "vitest";
import { MAX_VAULT_RECENTS, nextRecents, orderByRecent } from "@/lib/vaultRecents";
import type { VaultItem } from "@/lib/vaultRepository";

function item(id: string): VaultItem {
  return {
    id,
    kind: "login",
    name: id,
    tags: [],
    favorite: false,
    color: "#000",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("vault recents", () => {
  it("moves a reopened entry to the front without duplicating it", () => {
    expect(nextRecents(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(nextRecents(["a"], "b")).toEqual(["b", "a"]);
  });

  it("caps the list length", () => {
    const long = Array.from({ length: MAX_VAULT_RECENTS }, (_, index) => `id-${index}`);
    const next = nextRecents(long, "newest");
    expect(next).toHaveLength(MAX_VAULT_RECENTS);
    expect(next[0]).toBe("newest");
    expect(next).not.toContain(`id-${MAX_VAULT_RECENTS - 1}`);
  });

  it("orders items by recency and drops entries that no longer exist", () => {
    const ordered = orderByRecent([item("a"), item("b"), item("c")], ["b", "missing", "a"]);
    expect(ordered.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});
