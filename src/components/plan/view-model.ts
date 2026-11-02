import type { Curriculum } from "@/types/curriculum";
import type { AdjustedPlan, IsoDate, MergedPlan, PlanSettings, SavedPlan } from "@/types/plan";

export interface ViewItem { key: string; itemId: string; title: string; label: string; effortSec: number; moved: boolean }
export interface ViewDay { date: IsoDate; items: ViewItem[]; effortSec: number; targetSec: number | null; outOfRange: boolean }

export function daysFromAdjusted(curriculum: Curriculum, settings: PlanSettings, adjusted: AdjustedPlan): ViewDay[] {
  const byId = new Map(curriculum.items.map((item) => [item.id, item]));
  return adjusted.days.map((day) => ({
    date: day.date,
    items: day.itemIds.flatMap((id) => {
      const item = byId.get(id);
      if (!item) return [];
      const section = item.sectionId ? byId.get(item.sectionId) : null;
      return [{ key: id, itemId: id, title: item.title, label: section?.title ?? "수업", effortSec: (item.durationSec ?? 0) * settings.lectureMultiplier, moved: day.movedItemIds.includes(id) }];
    }),
    effortSec: day.effortSec,
    targetSec: day.targetSec,
    outOfRange: day.outOfRange,
  }));
}

export function daysFromMerged(plans: SavedPlan[], merged: MergedPlan): ViewDay[] {
  const byPlan = new Map(plans.map((plan) => [plan.id, plan]));
  return merged.days.map((day) => ({
    date: day.date,
    items: day.entries.flatMap((entry) => {
      const plan = byPlan.get(entry.planId);
      const item = plan?.curriculum.items.find((candidate) => candidate.id === entry.itemId);
      if (!plan || !item) return [];
      const section = plan.curriculum.items.find((candidate) => candidate.id === item.sectionId);
      return [{ key: `${entry.planId}:${entry.itemId}`, itemId: entry.itemId, title: item.title, label: `${plan.curriculum.title} · ${section?.title ?? "수업"}`, effortSec: entry.effortSec, moved: false }];
    }),
    effortSec: day.effortSec,
    targetSec: null,
    outOfRange: day.outOfRange,
  }));
}
