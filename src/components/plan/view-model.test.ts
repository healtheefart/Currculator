import { describe, expect, it } from "vitest";
import { daysFromAdjusted, daysFromMerged } from "./view-model";
import type { Curriculum } from "@/types/curriculum";
import type { SavedPlan } from "@/types/plan";

const curriculum: Curriculum = { title: "강의", sourceUrl: "https://www.inflearn.com/course/a", platform: "inflearn", courseId: "1", instructor: null, droppedCount: 0, items: [
  { id: "s", title: "섹션", level: 0, order: 0, sectionId: null, durationSec: null, source: "origin", excluded: false },
  { id: "i", title: "수업", level: 1, order: 1, sectionId: "s", durationSec: 600, source: "origin", excluded: false },
] };
const settings = { startDate: "2026-11-03", weekdayMinutes: [60, 60, 60, 60, 60, 60, 60] as [number, number, number, number, number, number, number], toleranceMinutes: 10, restDates: [], lectureMultiplier: 1 };

describe("plan view models", () => {
  it("maps an adjusted plan with the section label and movement", () => {
    const days = daysFromAdjusted(curriculum, settings, { days: [{ date: "2026-11-03", itemIds: ["i"], movedItemIds: ["i"], effortSec: 600, targetSec: 3600, outOfRange: true }], removedItemIds: [], baseDateById: { i: "2026-11-02" } });
    expect(days[0].items[0]).toMatchObject({ key: "i", label: "섹션", moved: true });
    expect(days[0].targetSec).toBe(3600);
  });

  it("namespaces merged keys and omits a target", () => {
    const plan: SavedPlan = { id: "p", curriculum, settings, overrides: {}, savedAt: "2026-11-03T00:00:00Z" };
    const days = daysFromMerged([plan], { days: [{ date: "2026-11-03", entries: [{ planId: "p", itemId: "i", effortSec: 600 }], effortSec: 600, outOfRange: false }] });
    expect(days[0].items[0]).toMatchObject({ key: "p:i", label: "강의 · 섹션", moved: false });
    expect(days[0].targetSec).toBeNull();
  });
});
