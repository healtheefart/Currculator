import { describe, expect, it } from "vitest";
import { summarizeDays } from "./summary";

describe("summarizeDays", () => {
  it("수업이 없으면 null/0", () => {
    expect(summarizeDays([])).toEqual({ totalEffortSec: 0, firstDate: null, lastDate: null, studyDays: 0, warnDays: 0 });
    expect(
      summarizeDays([{ date: "2026-11-03", itemIds: [], effortSec: 0, outOfRange: false }]),
    ).toEqual({ totalEffortSec: 0, firstDate: null, lastDate: null, studyDays: 0, warnDays: 0 });
  });

  it("itemIds가 있는 날만 센다", () => {
    expect(
      summarizeDays([
        { date: "2026-11-02", itemIds: [], effortSec: 0, outOfRange: false },
        { date: "2026-11-03", itemIds: ["a"], effortSec: 1800, outOfRange: true },
        { date: "2026-11-04", itemIds: ["b", "c"], effortSec: 3600.5, outOfRange: false },
        { date: "2026-11-06", itemIds: [], effortSec: 0, outOfRange: false },
      ]),
    ).toEqual({ totalEffortSec: 5400.5, firstDate: "2026-11-03", lastDate: "2026-11-04", studyDays: 2, warnDays: 1 });
  });

  it("entries 형태(전체 계획)도 센다", () => {
    expect(
      summarizeDays([
        { date: "2026-11-02", entries: [{}, {}], effortSec: 3000, outOfRange: true },
        { date: "2026-11-05", entries: [{}], effortSec: 600, outOfRange: true },
      ]),
    ).toEqual({ totalEffortSec: 3600, firstDate: "2026-11-02", lastDate: "2026-11-05", studyDays: 2, warnDays: 2 });
  });
});
