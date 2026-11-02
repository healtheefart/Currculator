import { describe, expect, it } from "vitest";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import type { Plan, PlanResult, PlanSettings, WeekdayMinutes } from "@/types/plan";
import { buildPlan } from "./schedule";

const MIN = 60;

/** 분 배열 → 섹션 1개 + 수업 n개(id: u0, u1, …) */
function curriculumOf(minutes: (number | null)[], extra: Partial<CurriculumItem>[] = []): Curriculum {
  const items: CurriculumItem[] = [
    { id: "s1", title: "섹션", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
    ...minutes.map((m, i) => ({
      id: `u${i}`,
      title: `수업 ${i}`,
      level: 1 as const,
      order: i + 1,
      sectionId: "s1",
      durationSec: m === null ? null : m * MIN,
      source: "origin" as const,
      excluded: false,
      ...extra[i],
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

const everyday = (m: number): WeekdayMinutes => [m, m, m, m, m, m, m];

function settings(partial: Partial<PlanSettings> = {}): PlanSettings {
  return {
    startDate: "2026-11-02", // 월요일
    weekdayMinutes: everyday(60),
    toleranceMinutes: 10,
    restDates: [],
    lectureMultiplier: 1,
    ...partial,
  };
}

function expectPlan(result: PlanResult): Plan {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.plan;
}

const ids = (plan: Plan) => plan.days.map((d) => d.itemIds);

describe("buildPlan — 배분 규칙", () => {
  it("25·20·18·30 → 63분에서 끊고 둘째 날 30", () => {
    const plan = expectPlan(buildPlan(curriculumOf([25, 20, 18, 30]), settings()));
    expect(ids(plan)).toEqual([["u0", "u1", "u2"], ["u3"]]);
    expect(plan.days[0]).toMatchObject({ date: "2026-11-02", effortSec: 63 * MIN, targetSec: 60 * MIN, outOfRange: false });
    expect(plan.days[1]).toMatchObject({ date: "2026-11-03", effortSec: 30 * MIN, outOfRange: true });
  });

  it("25·20·40 → 45분에서 끊고 경고, 둘째 날 40", () => {
    const plan = expectPlan(buildPlan(curriculumOf([25, 20, 40]), settings()));
    expect(ids(plan)).toEqual([["u0", "u1"], ["u2"]]);
    expect(plan.days[0]).toMatchObject({ effortSec: 45 * MIN, outOfRange: true });
  });

  it("80분 수업 하나 → 통째로 배정하고 경고", () => {
    const plan = expectPlan(buildPlan(curriculumOf([80]), settings()));
    expect(ids(plan)).toEqual([["u0"]]);
    expect(plan.days[0]).toMatchObject({ effortSec: 80 * MIN, outOfRange: true });
  });

  it("범위 밖 동률이면 짧은 쪽: 40·40 (40 vs 80, 차이 20)", () => {
    const plan = expectPlan(buildPlan(curriculumOf([40, 40]), settings()));
    expect(ids(plan)).toEqual([["u0"], ["u1"]]);
    expect(plan.days[0].outOfRange).toBe(true);
  });

  it("범위 안 동률: 30·25·10 → 55와 65 중 55", () => {
    const plan = expectPlan(buildPlan(curriculumOf([30, 25, 10]), settings()));
    expect(ids(plan)).toEqual([["u0", "u1"], ["u2"]]);
    expect(plan.days[0]).toMatchObject({ effortSec: 55 * MIN, outOfRange: false });
  });

  it("범위 안 지점 중 가용에 가장 가까운 곳: 52·5·10 → 57(52, 57, 67 중)", () => {
    const plan = expectPlan(buildPlan(curriculumOf([52, 5, 10]), settings()));
    expect(ids(plan)[0]).toEqual(["u0", "u1"]);
  });

  it("오차 ≥ 가용이면 하한을 0으로 처리한다 (가용 10, 오차 20)", () => {
    const plan = expectPlan(
      buildPlan(curriculumOf([5, 3, 4, 31]), settings({ weekdayMinutes: everyday(10), toleranceMinutes: 20 })),
    );
    // 누적 5, 8, 12, 43 → 범위 [0, 30] 안: 5, 8, 12 → 10에 가장 가까운 8과 12 동률 → 8
    expect(ids(plan)).toEqual([["u0", "u1"], ["u2"], ["u3"]]);
    expect(plan.days[0].outOfRange).toBe(false);
    expect(plan.days[1].outOfRange).toBe(false);
    expect(plan.days[2].outOfRange).toBe(true);
  });

  it("휴식일과 0분 요일을 건너뛴다", () => {
    // 2026-11-02 월, 화 0분, 수 휴식
    const weekdays: WeekdayMinutes = [60, 60, 0, 60, 60, 60, 60];
    const plan = expectPlan(
      buildPlan(curriculumOf([60, 60, 60]), settings({ weekdayMinutes: weekdays, restDates: ["2026-11-04"] })),
    );
    expect(plan.days.map((d) => d.date)).toEqual(["2026-11-02", "2026-11-05", "2026-11-06"]);
  });

  it("시작일이 쉬는 요일이면 다음 학습일부터", () => {
    const weekdays: WeekdayMinutes = [60, 0, 60, 60, 60, 60, 60];
    const plan = expectPlan(buildPlan(curriculumOf([60]), settings({ weekdayMinutes: weekdays })));
    expect(plan.days[0].date).toBe("2026-11-03");
    expect(plan.startDate).toBe("2026-11-02");
  });

  it("요일별 가용 분이 다르면 그날 목표를 쓴다", () => {
    // 월 30분, 화 120분
    const weekdays: WeekdayMinutes = [0, 30, 120, 0, 0, 0, 0];
    const plan = expectPlan(
      buildPlan(curriculumOf([30, 60, 60, 30]), settings({ weekdayMinutes: weekdays })),
    );
    expect(plan.days[0]).toMatchObject({ date: "2026-11-02", targetSec: 30 * MIN, itemIds: ["u0"] });
    expect(plan.days[1]).toMatchObject({ date: "2026-11-03", targetSec: 120 * MIN, itemIds: ["u1", "u2"] });
    expect(plan.days[2]).toMatchObject({ date: "2026-11-09", targetSec: 30 * MIN, itemIds: ["u3"] });
  });

  it("총량 보존, 목차 순서 유지, 중복 없음", () => {
    const minutes = [12, 47, 3, 33, 25, 90, 8, 15, 41, 22, 60, 5, 17];
    const c = curriculumOf(minutes);
    const plan = expectPlan(buildPlan(c, settings({ lectureMultiplier: 1.5 })));
    const flat = plan.days.flatMap((d) => d.itemIds);
    expect(flat).toEqual(minutes.map((_, i) => `u${i}`));
    expect(new Set(flat).size).toBe(flat.length);
    const sum = plan.days.reduce((acc, d) => acc + d.effortSec, 0);
    expect(sum).toBeCloseTo(plan.totalEffortSec, 9);
    expect(plan.totalEffortSec).toBeCloseTo(minutes.reduce((a, b) => a + b, 0) * MIN * 1.5, 9);
    expect(plan.days.every((d) => d.itemIds.length >= 1)).toBe(true);
    expect(plan.endDate).toBe(plan.days[plan.days.length - 1].date);
  });

  it("제외·시간 누락 수업은 배정하지 않고, 누락은 missingItemIds에 넣는다", () => {
    const c = curriculumOf([20, null, 20, 0, 20], [{}, {}, { excluded: true }, {}, {}]);
    const plan = expectPlan(buildPlan(c, settings()));
    expect(ids(plan)).toEqual([["u0", "u4"]]);
    expect(plan.missingItemIds).toEqual(["u1", "u3"]);
    expect(plan.totalEffortSec).toBe(40 * MIN);
  });

  it("배수 1.5를 적용한다", () => {
    // 20분 × 1.5 = 30분씩 → 누적 30, 60, 90 → 60에서 끊음
    const plan = expectPlan(buildPlan(curriculumOf([20, 20, 20]), settings({ lectureMultiplier: 1.5 })));
    expect(ids(plan)).toEqual([["u0", "u1"], ["u2"]]);
    expect(plan.days[0].effortSec).toBe(60 * MIN);
    expect(plan.totalEffortSec).toBe(90 * MIN);
  });

  it("소수 예상 시간도 반올림하지 않는다", () => {
    const c = curriculumOf([]);
    c.items.push({ id: "x", title: "x", level: 1, order: 1, sectionId: "s1", durationSec: 61, source: "origin", excluded: false });
    const plan = expectPlan(buildPlan(c, settings({ lectureMultiplier: 1.5 })));
    expect(plan.days[0].effortSec).toBe(91.5);
  });
});

describe("buildPlan — 실패", () => {
  it("모든 요일 0분 → NO_STUDY_DAYS (missingItemIds 포함)", () => {
    const result = buildPlan(curriculumOf([20, null]), settings({ weekdayMinutes: everyday(0) }));
    expect(result).toEqual({ ok: false, reason: "NO_STUDY_DAYS", missingItemIds: ["u1"] });
  });

  it("배정 대상 0개 → NO_ITEMS (missingItemIds 포함)", () => {
    const c = curriculumOf([null, 20], [{}, { excluded: true }]);
    expect(buildPlan(c, settings())).toEqual({ ok: false, reason: "NO_ITEMS", missingItemIds: ["u0"] });
  });

  it("입력을 변경하지 않는다", () => {
    const c = curriculumOf([25, 20, 18, 30]);
    const s = settings({ restDates: ["2026-11-03"] });
    const before = JSON.stringify([c, s]);
    buildPlan(c, s);
    expect(JSON.stringify([c, s])).toBe(before);
  });
});
