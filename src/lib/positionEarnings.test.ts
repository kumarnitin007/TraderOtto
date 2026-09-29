import { describe, expect, it } from "vitest";
import { crossesEarnings } from "@/lib/earningsCache";

describe("crossesEarnings", () => {
  it("flags an open spread that expires on or after the next earnings date", () => {
    expect(crossesEarnings("2026-10-16", "2026-10-09", "2026-09-29")).toBe(true);
    expect(crossesEarnings("2026-10-09", "2026-10-09", "2026-09-29")).toBe(true);
  });

  it("ignores earnings after expiry or already reported", () => {
    expect(crossesEarnings("2026-10-02", "2026-10-16", "2026-09-29")).toBe(false);
    expect(crossesEarnings("2026-10-16", "2026-09-20", "2026-09-29")).toBe(false);
    expect(crossesEarnings("2026-10-16", null, "2026-09-29")).toBe(false);
  });
});
