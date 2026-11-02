import { describe, expect, it } from "vitest";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import type { AdjustedPlan, PlanSettings } from "@/types/plan";
import { mergePlans, type MergeInput } from "./merge";

const MIN = 60;

function curriculumOf(prefix: string, minutes: number[]): Curriculum {
  const items: CurriculumItem[] = minutes.map((m, i) => ({
    id: `${prefix}${i}`,
    title: `${prefix} 수업 ${i}`,
    level: 1,
    order: i,
    sectionId: "s",
    durationSec: m * MIN,
    source: "origin",
    excluded: false,
  }));
  return {
    title: prefix,
    sourceUrl: "https://www.inflearn.com/course/x",
    platform: "inflearn",
    courseId: prefix,
    instructor: null,
    droppedCount: 0,
    items,
  };
}

function settingsWith(multiplier: number): PlanSettings {
  return {
    startDate: "2026-11-02",
    weekdayMinutes: [60, 60, 60, 60, 60, 60, 60],
    toleranceMinutes: 10,
    restDates: [],
    lectureMultiplier: multiplier,
  };
}

function day(date: string, itemIds: string[], effortSec: number, outOfRange = false) {
  return { date, itemIds, effortSec, targetSec: 60 * MIN, outOfRange, movedItemIds: [] };
}

const a: MergeInput = {
  planId: "A",
  curriculum: curriculumOf("a", [20, 40, 30]),
  settings: settingsWith(1),
  adjusted: {
    days: [day("2026-11-03", ["a0", "a1"], 60 * MIN), day("2026-11-04", [], 0), day("2026-11-05", ["a2"], 30 * MIN, true)],
    removedItemIds: [],
    baseDateById: {},
  } satisfies AdjustedPlan,
};

const b: MergeInput = {
  planId: "B",
  curriculum: curriculumOf("b", [20, 40]),
  settings: settingsWith(1.5),
  adjusted: {
    days: [day("2026-11-02", ["b0"], 30 * MIN, true), day("2026-11-03", ["b1"], 60 * MIN)],
    removedItemIds: [],
    baseDateById: {},
  },
};

describe("mergePlans", () => {
  it("빈 입력 → 빈 날짜 목록", () => {
    expect(mergePlans([])).toEqual({ days: [] });
  });

  it("날짜별로 합치고 날짜 오름차순, 수업 없는 날은 뺀다", () => {
    const merged = mergePlans([a, b]);
    expect(merged.days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-05"]);
  });

  it("entries는 계획 순서 → 그 계획의 itemIds 순서, effortSec은 계획 배수로 계산", () => {
    const merged = mergePlans([a, b]);
    expect(merged.days[1].entries).toEqual([
      { planId: "A", itemId: "a0", effortSec: 20 * MIN },
      { planId: "A", itemId: "a1", effortSec: 40 * MIN },
      { planId: "B", itemId: "b1", effortSec: 60 * MIN },
    ]);
    expect(merged.days[1].effortSec).toBe(120 * MIN);

    const reversed = mergePlans([b, a]);
    expect(reversed.days[1].entries.map((e) => e.itemId)).toEqual(["b1", "a0", "a1"]);
  });

  it("그날 계획 중 하나라도 범위 밖이면 경고", () => {
    const merged = mergePlans([a, b]);
    expect(merged.days.map((d) => d.outOfRange)).toEqual([true, false, true]);

    const warnA: MergeInput = {
      ...a,
      adjusted: { ...a.adjusted, days: [day("2026-11-03", ["a0"], 20 * MIN, true)] },
    };
    expect(mergePlans([warnA, b]).days[1].outOfRange).toBe(true);
  });
});
