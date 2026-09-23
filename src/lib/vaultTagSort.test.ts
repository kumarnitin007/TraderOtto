import { describe, expect, it } from "vitest";
import type { VaultItem, VaultTag } from "@/lib/vaultRepository";
import { sortVaultTags } from "@/lib/vaultTagSort";

function tag(id: string, name: string): VaultTag {
  return { id, name, color: "#000" };
}

function item(tags: string[]): VaultItem {
  return {
    id: tags.join("-") || "none",
    kind: "login",
    name: "Item",
    tags,
    favorite: false,
    color: "#000",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("sortVaultTags", () => {
  const tags = [tag("b", "Work"), tag("a", "Alpha"), tag("c", "beta")];
  const items = [item(["b"]), item(["b"]), item(["c"])];

  it("sorts by name A–Z", () => {
    expect(sortVaultTags(tags, items, "name-asc").map((t) => t.name)).toEqual([
      "Alpha",
      "beta",
      "Work",
    ]);
  });

  it("sorts by usage count, then name", () => {
    expect(sortVaultTags(tags, items, "count-desc").map((t) => t.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortVaultTags(tags, items, "count-asc").map((t) => t.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});
