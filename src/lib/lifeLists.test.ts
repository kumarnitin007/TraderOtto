import { describe, expect, it } from "vitest";
import { dueListItems } from "@/lib/lifeLists";
import type { LifeListItem } from "@/types/life";

function item(patch: Partial<LifeListItem> & Pick<LifeListItem, "id" | "text">): LifeListItem {
  return {
    listId: "list",
    done: false,
    dueOn: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...patch,
  };
}

describe("due list items", () => {
  it("keeps open items that are due today or earlier", () => {
    const due = dueListItems(
      [
        item({ id: "a", text: "Call the school", dueOn: "2026-09-26" }),
        item({ id: "b", text: "Buy milk", dueOn: "2026-09-20" }),
        item({ id: "c", text: "Later", dueOn: "2026-10-01" }),
        item({ id: "d", text: "Done already", dueOn: "2026-09-20", done: true }),
        item({ id: "e", text: "No date" }),
      ],
      new Date(2026, 8, 26),
    );
    expect(due.map((entry) => entry.text)).toEqual(["Buy milk", "Call the school"]);
  });
});
