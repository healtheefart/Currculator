import type { Curriculum } from "@/types/curriculum";

/** 예상 학습시간(초) = 재생시간 × 배수. 반올림하지 않는다. */
export function effortSec(durationSec: number, multiplier: number): number {
  return durationSec * multiplier;
}

export function toSchedulable(
  curriculum: Curriculum,
  multiplier: number,
): {
  schedulable: { id: string; effortSec: number }[];
  missingIds: string[];
} {
  const lessons = curriculum.items
    .filter((item) => item.level === 1 && !item.excluded)
    .sort((a, b) => a.order - b.order);

  const schedulable: { id: string; effortSec: number }[] = [];
  const missingIds: string[] = [];
  for (const item of lessons) {
    if (item.durationSec !== null && item.durationSec > 0) {
      schedulable.push({ id: item.id, effortSec: effortSec(item.durationSec, multiplier) });
    } else {
      missingIds.push(item.id);
    }
  }
  return { schedulable, missingIds };
}
