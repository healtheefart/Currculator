"use client";

import type { Curriculum } from "@/types/curriculum";
import type { PlanSettings } from "@/types/plan";
import { formatDuration } from "@/lib/format/duration";

export function RemovedList({ curriculum, settings, removedItemIds, onRestore }: { curriculum: Curriculum; settings: PlanSettings; removedItemIds: string[]; onRestore: (itemId: string) => void }) {
  if (!removedItemIds.length) return null;
  const byId = new Map(curriculum.items.map((item) => [item.id, item]));
  return <section className="mt-8 rounded-lg border border-hairline bg-canvas p-5">
    <h3 className="cc-type-body-strong">제외한 수업 {removedItemIds.length}개</h3>
    <div className="mt-4 space-y-3">{removedItemIds.map((id) => {
      const item = byId.get(id);
      if (!item) return null;
      const section = item.sectionId ? byId.get(item.sectionId) : null;
      return <div key={id} className="flex items-center justify-between gap-3 border-t border-divider pt-3">
        <div className="min-w-0 text-text-secondary"><p className="cc-type-fine-print">{section?.title ?? "수업"}</p><p className="truncate">{item.title}</p><p className="cc-type-caption">{formatDuration((item.durationSec ?? 0) * settings.lectureMultiplier)}</p></div>
        <button type="button" onClick={() => onRestore(id)} className="shrink-0 cursor-pointer text-primary">다시 넣기</button>
      </div>;
    })}</div>
  </section>;
}
