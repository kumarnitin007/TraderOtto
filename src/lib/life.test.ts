import { describe, expect, it } from "vitest";
import { lifeDaysUntil, lifeOccasionLabel, parseLeoEvents } from "@/lib/life";

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
});
