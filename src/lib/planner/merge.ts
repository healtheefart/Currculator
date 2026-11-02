import type { Curriculum } from "@/types/curriculum";
import type { AdjustedPlan, IsoDate, MergedDay, MergedPlan, PlanSettings } from "@/types/plan";
import { effortSec } from "./effort";

export interface MergeInput {
  planId: string;
  curriculum: Curriculum;
  settings: PlanSettings;
  adjusted: AdjustedPlan;
}

/** 여러 계획의 날짜별 결과를 입력(저장) 순서대로 합친다. 수업이 없는 날은 뺀다. */
export function mergePlans(inputs: MergeInput[]): MergedPlan {
  const byDate = new Map<IsoDate, MergedDay>();

  for (const input of inputs) {
    const durationById = new Map(input.curriculum.items.map((item) => [item.id, item.durationSec ?? 0]));
    for (const day of input.adjusted.days) {
      if (day.itemIds.length === 0) continue;
      let merged = byDate.get(day.date);
      if (!merged) {
        merged = { date: day.date, entries: [], effortSec: 0, outOfRange: false };
        byDate.set(day.date, merged);
      }
      for (const itemId of day.itemIds) {
        const sec = effortSec(durationById.get(itemId) ?? 0, input.settings.lectureMultiplier);
        merged.entries.push({ planId: input.planId, itemId, effortSec: sec });
        merged.effortSec += sec;
      }
      merged.outOfRange = merged.outOfRange || day.outOfRange;
    }
  }

  return { days: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) };
}
