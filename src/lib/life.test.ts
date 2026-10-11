import { describe, expect, it } from "vitest";
import {
  lifeDaysUntil,
  lifeMilestones,
  lifeOccasionLabel,
  lifeOnThisDay,
  milestoneNotificationThreshold,
  milestoneSnoozed,
  parseLeoEvents,
  snoozeMilestone,
} from "@/lib/life";

const CSV = `### Tasks ###
id,name
"skip-me","In bed before 10:30pm"

### Events ###
id,name,description,category,tags,date,frequency,customFrequency,year,notifyDaysBefore,color,priority,hideFromDashboard,createdAt
"1","Kaashvi Birthday","my fav daughter b-day","Birthday","[]","07-26","yearly","","2013","3","#EC4899","5","false","2026-01-09T00:00:00Z"
"2","My Anniversary","","Anniversary","[""Milestone""]","07-21","yearly","","2008","3","#EF4444","5","false","2026-01-09T00:00:00Z"
"3","New Years Eve 2026","Enjoy","Holiday","[""Milestone""]","2026-12-31","one-time","","2026","3","#8B5CF6","5","false","2026-01-13T00:00:00Z"
"4","Call up robin hood","","","[]","2026-03-23","one-time","","","1","","5","false","2026-03-23T00:00:00Z"
"5","Doggy Birthday","","Birthday","[]","2006-10-13","one-time","","","3","#EC4899","5","false","2026-01-09T00:00:00Z"

### Todos ###
id,name
"nope","Buy milk"
`;

describe("life dates", () => {
  it("imports birthdays, anniversaries, and holidays, and skips tasks", () => {
    const items = parseLeoEvents(CSV);
    expect(items.map((item) => item.name)).toEqual([
      "Kaashvi Birthday",
      "My Anniversary",
      "New Years Eve 2026",
      "Doggy Birthday",
    ]);
    expect(items[0]).toMatchObject({
      category: "birthday",
      month: 7,
      day: 26,
      year: 2013,
      repeats: "yearly",
      remindDays: 3,
      milestone: false,
    });
    expect(items[1].milestone).toBe(true);
    expect(items[2]).toMatchObject({ category: "holiday", repeats: "once", occursOn: "2026-12-31" });
    expect(items[3]).toMatchObject({ repeats: "yearly", month: 10, day: 13, year: 2006 });
  });

  it("counts days to the next yearly date and the age that day", () => {
    const item = {
      category: "birthday" as const,
      year: 2013,
      repeats: "yearly" as const,
      month: 7,
      day: 26,
      occursOn: null,
    };
    expect(lifeDaysUntil(item, new Date(2026, 6, 22))).toBe(4);
    expect(lifeOccasionLabel(item, new Date(2026, 6, 22))).toBe("Turns 13");
    expect(lifeDaysUntil(item, new Date(2026, 6, 26))).toBe(0);
  });

  it("matches Life dates that fall on this month and day", () => {
    const birthday = {
      id: "1",
      name: "Kaashvi",
      category: "birthday" as const,
      notes: "",
      month: 9,
      day: 29,
      year: 2013,
      occursOn: null,
      repeats: "yearly" as const,
      remindDays: 0,
      milestone: false,
      createdAt: "",
      updatedAt: "",
    };
    expect(lifeOnThisDay([birthday], "2026-09-29").map((item) => item.name)).toEqual(["Kaashvi"]);
    expect(lifeOnThisDay([birthday], "2026-09-28")).toEqual([]);
  });

  it("lists every milestone in the chosen window in date order", () => {
    const base = {
      category: "special" as const,
      notes: "",
      year: null,
      occursOn: null,
      repeats: "yearly" as const,
      remindDays: 3,
      milestone: true,
      createdAt: "",
      updatedAt: "",
    };
    const items = [
      { ...base, id: "later", name: "Later", month: 4, day: 15 },
      { ...base, id: "soon", name: "Soon", month: 2, day: 1 },
      { ...base, id: "outside", name: "Outside", month: 10, day: 1 },
    ];
    expect(
      lifeMilestones(items, 90, new Date(2026, 0, 1)).map(({ item }) => item.id),
    ).toEqual(["soon"]);
    expect(
      lifeMilestones(items, 365, new Date(2026, 0, 1)).map(({ item }) => item.id),
    ).toEqual(["soon", "later", "outside"]);
  });

  it("hides a milestone from Today until the chosen day", () => {
    const store = new Map<string, string>();
    const previous = globalThis.window;
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis;
    try {
      const today = new Date(2026, 9, 11);
      snoozeMilestone("soon", 7, today);
      expect(milestoneSnoozed("soon", today)).toBe(true);
      expect(milestoneSnoozed("soon", new Date(2026, 9, 17))).toBe(true);
      expect(milestoneSnoozed("soon", new Date(2026, 9, 18))).toBe(false);
      expect(milestoneSnoozed("other", today)).toBe(false);
    } finally {
      globalThis.window = previous;
    }
  });

  it("uses fixed milestone notification thresholds", () => {
    expect([91, 90, 30, 7, 1, 0, -1].map(milestoneNotificationThreshold)).toEqual([
      null,
      90,
      30,
      7,
      1,
      0,
      null,
    ]);
  });
});
