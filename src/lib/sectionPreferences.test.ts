import { describe, expect, it } from "vitest";
import {
  normalizeDefaultSection,
  normalizeEnabledSections,
  withSectionToggled,
} from "@/lib/sectionPreferences";

describe("section preferences", () => {
  it("keeps every section on when nothing has been saved", () => {
    expect(normalizeEnabledSections(undefined)).toEqual([
      "trader",
      "vault",
      "books",
      "journal",
      "life",
      "banks",
    ]);
  });

  it("drops unknown ids and refuses an empty selection", () => {
    expect(normalizeEnabledSections(["books", "nope"])).toEqual(["books"]);
    expect(normalizeEnabledSections([])).toEqual([
      "trader",
      "vault",
      "books",
      "journal",
      "life",
      "banks",
    ]);
  });

  it("keeps the home section inside the visible list", () => {
    expect(normalizeDefaultSection("vault", ["books", "life"])).toBe("books");
    expect(normalizeDefaultSection("life", ["books", "life"])).toBe("life");
  });

  it("moves home and the open section when the current one is hidden", () => {
    expect(withSectionToggled(["trader", "books"], "trader", "trader", "trader")).toEqual({
      enabledSections: ["books"],
      defaultSection: "books",
      appWorkspace: "books",
    });
  });

  it("leaves the last visible section on", () => {
    expect(withSectionToggled(["life"], "life", "life", "life").enabledSections).toEqual([
      "life",
    ]);
  });
});
