import { describe, expect, it } from "vitest";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import type { Plan, PlanSettings, WeekdayMinutes } from "@/types/plan";
import { applyOverrides } from "./overrides";
import { buildPlan } from "./schedule";

const MIN = 60;

function curriculumOf(minutes: number[]): Curriculum {
  const items: CurriculumItem[] = [
    { id: "s1", title: "섹션", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
    ...minutes.map((m, i) => ({
      id: `u${i}`,
      title: `수업 ${i}`,
      level: 1 as const,
      order: i + 1,
      sectionId: "s1",
      durationSec: m * MIN,
      source: "origin" as const,
      excluded: false,
    })),
  ];
  return {
    title: "강의",
    sourceUrl: "https://www.inflearn.com/course/x",
    platform: "inflearn",
    courseId: "1",
    instructor: null,
    droppedCount: 0,
    items,
  };
}

// 2026-11-02 월요일 시작, 평일 60분 / 주말 0분 (토요일만 120분)
const weekdays: WeekdayMinutes = [0, 60, 60, 60, 60, 60, 120];
const settings: PlanSettings = {
  startDate: "2026-11-02",
  weekdayMinutes: weekdays,
  toleranceMinutes: 10,
  restDates: [],
  lectureMultiplier: 1,
};

// 30·30 / 30·30 / 60 → 월 [u0,u1] 60분, 화 [u2,u3] 60분, 수 [u4] 60분
const curriculum = curriculumOf([30, 30, 30, 30, 60]);

function basePlan(): Plan {
  const result = buildPlan(curriculum, settings);
  if (!result.ok) throw new Error("plan failed");
  return result.plan;
}

describe("applyOverrides", () => {
  it("기준 계획 확인", () => {
    expect(basePlan().days.map((d) => d.itemIds)).toEqual([["u0", "u1"], ["u2", "u3"], ["u4"]]);
  });

  it("빈 overrides → plan.days와 같고 movedItemIds는 비어 있다", () => {
    const plan = basePlan();
    const adjusted = applyOverrides(plan, curriculum, settings, {});
    expect(adjusted.days).toEqual(plan.days.map((d) => ({ ...d, movedItemIds: [] })));
    expect(adjusted.removedItemIds).toEqual([]);
    expect(adjusted.baseDateById).toEqual({
      u0: "2026-11-02",
      u1: "2026-11-02",
      u2: "2026-11-03",
      u3: "2026-11-03",
      u4: "2026-11-04",
    });
  });

  it("다른 학습일로 옮기면 양쪽 합계와 경고를 다시 계산한다", () => {
    const adjusted = applyOverrides(basePlan(), curriculum, settings, { u1: "2026-11-04" });
    const [mon, , wed] = adjusted.days;
    expect(mon).toMatchObject({ itemIds: ["u0"], effortSec: 30 * MIN, outOfRange: true, movedItemIds: [] });
    expect(wed).toMatchObject({ itemIds: ["u1", "u4"], effortSec: 90 * MIN, outOfRange: true, movedItemIds: ["u1"] });
  });

  it("학습일이 아닌 날로 옮기면 새 날을 만들고 날짜순으로 정렬한다", () => {
    const adjusted = applyOverrides(basePlan(), curriculum, settings, {
      u4: "2026-11-07", // 토요일, 120분
      u0: "2026-11-01", // 일요일, 0분 → 이전 날짜
    });
    expect(adjusted.days.map((d) => d.date)).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-07",
    ]);
    expect(adjusted.days[0]).toMatchObject({ itemIds: ["u0"], targetSec: 0, effortSec: 30 * MIN, outOfRange: true, movedItemIds: ["u0"] });
    expect(adjusted.days[4]).toMatchObject({ itemIds: ["u4"], targetSec: 120 * MIN, effortSec: 60 * MIN, outOfRange: true, movedItemIds: ["u4"] });
    // 수요일은 비었지만 남는다
    expect(adjusted.days[3]).toMatchObject({ date: "2026-11-04", itemIds: [], effortSec: 0, outOfRange: false, movedItemIds: [] });
  });

  it("원래 날짜로 옮기면 옮김이 아니다", () => {
    const plan = basePlan();
    const adjusted = applyOverrides(plan, curriculum, settings, { u2: "2026-11-03" });
    expect(adjusted.days).toEqual(plan.days.map((d) => ({ ...d, movedItemIds: [] })));
  });

  it("null이면 계획에서 빼고 removedItemIds에 목차 순서로 넣는다. 빈 날은 남는다", () => {
    const adjusted = applyOverrides(basePlan(), curriculum, settings, { u4: null, u1: null });
    expect(adjusted.removedItemIds).toEqual(["u1", "u4"]);
    expect(adjusted.days.map((d) => d.itemIds)).toEqual([["u0"], ["u2", "u3"], []]);
    expect(adjusted.days[2]).toMatchObject({ effortSec: 0, outOfRange: false });
  });

  it("옮겨 온 수업은 목차 순서로 정렬한다", () => {
    const adjusted = applyOverrides(basePlan(), curriculum, settings, { u0: "2026-11-03", u4: "2026-11-03" });
    expect(adjusted.days[1].itemIds).toEqual(["u0", "u2", "u3", "u4"]);
    expect(adjusted.days[1].movedItemIds).toEqual(["u0", "u4"]);
    expect(adjusted.days[1].effortSec).toBe(150 * MIN);
  });

  it("자동 배분 결과에 없는 id는 무시한다", () => {
    const plan = basePlan();
    const adjusted = applyOverrides(plan, curriculum, settings, { ghost: "2026-11-05", s1: null });
    expect(adjusted.days).toEqual(plan.days.map((d) => ({ ...d, movedItemIds: [] })));
    expect(adjusted.removedItemIds).toEqual([]);
  });

  it("허용 오차 경계와 소수 합계를 1e-9 오차로 비교한다", () => {
    // 배수 1.1: 수업 10분 → 11분(660초). 50분 목표 ±10 범위 등 부동소수 오차 경계 확인
    const c = curriculumOf([10, 10, 10, 10, 10, 10]);
    const s: PlanSettings = { ...settings, weekdayMinutes: [70, 70, 70, 70, 70, 70, 70], lectureMultiplier: 1.1 };
    const result = buildPlan(c, s);
    if (!result.ok) throw new Error("plan failed");
    const adjusted = applyOverrides(result.plan, c, s, {});
    expect(adjusted.days.map((d) => d.outOfRange)).toEqual(result.plan.days.map((d) => d.outOfRange));
  });

  it("입력을 변경하지 않는다", () => {
    const plan = basePlan();
    const overrides = { u0: "2026-11-07", u1: null };
    const before = JSON.stringify([plan, curriculum, settings, overrides]);
    applyOverrides(plan, curriculum, settings, overrides);
    expect(JSON.stringify([plan, curriculum, settings, overrides])).toBe(before);
  });
});
