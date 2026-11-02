import { describe, expect, it } from "vitest";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";
import { effortSec, toSchedulable } from "./effort";

function item(partial: Partial<CurriculumItem> & Pick<CurriculumItem, "id" | "order">): CurriculumItem {
  return {
    title: partial.id,
    level: 1,
    sectionId: "s1",
    durationSec: 600,
    source: "origin",
    excluded: false,
    ...partial,
  };
}

function curriculum(items: CurriculumItem[]): Curriculum {
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

describe("effortSec", () => {
  it("배수를 곱하고 반올림하지 않는다", () => {
    expect(effortSec(600, 1.5)).toBe(900);
    expect(effortSec(61, 1.5)).toBe(91.5);
    expect(effortSec(100, 1)).toBe(100);
  });
});

describe("toSchedulable", () => {
  const c = curriculum([
    item({ id: "s1", order: 0, level: 0, sectionId: null, durationSec: null }),
    item({ id: "a", order: 1, durationSec: 600 }),
    item({ id: "b", order: 2, durationSec: null }),
    item({ id: "c", order: 3, durationSec: 0 }),
    item({ id: "d", order: 4, durationSec: 300, excluded: true }),
    item({ id: "e", order: 5, durationSec: null, excluded: true }),
    item({ id: "f", order: 6, durationSec: 61 }),
  ]);

  it("level 1, 제외 아님, 시간 > 0만 목차 순서대로 배정 대상", () => {
    expect(toSchedulable(c, 1.5).schedulable).toEqual([
      { id: "a", effortSec: 900 },
      { id: "f", effortSec: 91.5 },
    ]);
  });

  it("제외 아닌 수업 중 시간 null·0은 누락", () => {
    expect(toSchedulable(c, 1.5).missingIds).toEqual(["b", "c"]);
  });

  it("order 기준으로 정렬한다", () => {
    const shuffled = curriculum([
      item({ id: "y", order: 2 }),
      item({ id: "x", order: 1 }),
    ]);
    expect(toSchedulable(shuffled, 1).schedulable.map((s) => s.id)).toEqual(["x", "y"]);
  });
});
