import { weekdayOf } from "@/lib/date/kst";
import type { Curriculum } from "@/types/curriculum";
import type { AdjustedDay, AdjustedPlan, IsoDate, Plan, PlanOverrides, PlanSettings } from "@/types/plan";
import { effortSec } from "./effort";
import { isOutOfRange } from "./schedule";

/**
 * 자동 배분 결과 위에 사용자의 직접 조정(옮김·제외)을 덧씌운다 (ADR-014).
 * 순수 함수: 입력을 변경하지 않는다.
 */
export function applyOverrides(
  plan: Plan,
  curriculum: Curriculum,
  settings: PlanSettings,
  overrides: PlanOverrides,
): AdjustedPlan {
  const orderById = new Map<string, number>();
  const effortById = new Map<string, number>();
  for (const item of curriculum.items) {
    orderById.set(item.id, item.order);
    effortById.set(item.id, effortSec(item.durationSec ?? 0, settings.lectureMultiplier));
  }
  const byOrder = (a: string, b: string) => (orderById.get(a) ?? 0) - (orderById.get(b) ?? 0);

  const baseDateById: Record<string, IsoDate> = {};
  const targetByDate = new Map<IsoDate, number>();
  const itemsByDate = new Map<IsoDate, string[]>();
  const movedByDate = new Map<IsoDate, string[]>();
  for (const day of plan.days) {
    targetByDate.set(day.date, day.targetSec);
    itemsByDate.set(day.date, []);
    movedByDate.set(day.date, []);
    for (const id of day.itemIds) baseDateById[id] = day.date;
  }

  const removedItemIds: string[] = [];
  for (const day of plan.days) {
    for (const id of day.itemIds) {
      const override = Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : undefined;
      if (override === null) {
        removedItemIds.push(id);
        continue;
      }
      const date = override === undefined ? day.date : override;
      if (!itemsByDate.has(date)) {
        itemsByDate.set(date, []);
        movedByDate.set(date, []);
        targetByDate.set(date, settings.weekdayMinutes[weekdayOf(date)] * 60);
      }
      itemsByDate.get(date)!.push(id);
      if (date !== day.date) movedByDate.get(date)!.push(id);
    }
  }

  const days: AdjustedDay[] = [...itemsByDate.keys()].sort().map((date) => {
    const itemIds = [...itemsByDate.get(date)!].sort(byOrder);
    const targetSec = targetByDate.get(date)!;
    const sum = itemIds.reduce((acc, id) => acc + (effortById.get(id) ?? 0), 0);
    return {
      date,
      itemIds,
      effortSec: sum,
      targetSec,
      outOfRange: itemIds.length > 0 && isOutOfRange(sum, targetSec, settings.toleranceMinutes),
      movedItemIds: [...movedByDate.get(date)!].sort(byOrder),
    };
  });

  return { days, removedItemIds: removedItemIds.sort(byOrder), baseDateById };
}
