import { describe, expect, it } from "vitest";
import { parseLeoTasks, taskProgress } from "@/lib/lifeTasks";

const CSV = `### Tasks ###
id,name,description,category,color,customBackgroundColor,weightage,frequency,daysOfWeek,dayOfMonth,customFrequency,frequencyCount,frequencyPeriod,intervalValue,intervalUnit,intervalStartDate,startDate,endDate,specificDate,endTime,dependentTaskIds,onHold,holdStartDate,holdEndDate,holdReason,tags,createdAt
"1","10 Mins Prayers","","Self Care","#06B6D4","","5","daily","","","","","","","","","","","","","[]","false","","","","[]","2026-01-14T00:00:00Z"
"2","Go to Office","Office three times a week","Work","#EF4444","","3","count-based","","","","3","week","3","weeks","","","","","12:08:00","[]","false","","","","[]","2026-01-05T00:00:00Z"
"3","Call once","One time","","","","5","custom","","","","","","","","","","","","","[]","false","","","","[]","2026-01-05T00:00:00Z"

### Events ###
id,name
"4","Kaashvi Birthday"
`;

describe("tracked tasks", () => {
  it("imports daily habits and weekly counts, and skips one-time tasks", () => {
    expect(parseLeoTasks(CSV)).toEqual([
      { name: "10 Mins Prayers", notes: "", cadence: "daily", targetCount: 1 },
      {
        name: "Go to Office",
        notes: "Office three times a week",
        cadence: "weekly",
        targetCount: 3,
      },
    ]);
  });

  it("counts weekly checks inside the current Monday week", () => {
    const progress = taskProgress(
      { id: "office", cadence: "weekly", targetCount: 3 },
      [
        { taskId: "office", doneOn: "2026-09-21" },
        { taskId: "office", doneOn: "2026-09-23" },
        { taskId: "office", doneOn: "2026-09-14" },
      ],
      new Date(2026, 8, 25),
    );
    expect(progress).toMatchObject({ count: 2, target: 3, doneToday: false });
  });
});
