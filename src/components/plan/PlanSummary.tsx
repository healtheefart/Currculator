"use client";

import { formatMonthDay } from "@/lib/format/date";
import { formatDuration } from "@/lib/format/duration";
import { IconButton } from "@/components/ui/IconButton";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import type { ViewDay } from "./view-model";

export function PlanSummary({ title, planCount, days, onEdit, onDelete }: { title: string; planCount?: number; days: ViewDay[]; onEdit?: () => void; onDelete?: () => void }) {
  const studied = days.filter((day) => day.items.length > 0);
  const total = studied.reduce((sum, day) => sum + day.effortSec, 0);
  const warnings = studied.filter((day) => day.outOfRange).length;
  return <section className="rounded-lg border border-hairline bg-canvas p-6" aria-label="계획 요약">
    <div className="flex items-start justify-between gap-3">
      <h2 className="cc-type-tagline min-w-0 break-words">{title}</h2>
      {(onEdit || onDelete) && <div className="flex shrink-0 gap-2">
        {onEdit && <IconButton label="계획 수정" icon={<PencilIcon />} onClick={onEdit} />}
        {onDelete && <IconButton label="계획 삭제" icon={<TrashIcon />} onClick={onDelete} />}
      </div>}
    </div>
    {planCount !== undefined && <p className="cc-type-caption text-text-secondary">계획 {planCount}개</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-4">
      <div><p className="cc-type-fine-print text-text-tertiary">예상 학습 시간</p><strong className="cc-type-body-strong tabular-nums">{formatDuration(total)}</strong></div>
      <div><p className="cc-type-fine-print text-text-tertiary">기간</p><strong className="cc-type-body-strong tabular-nums">{studied.length ? `${formatMonthDay(studied[0].date)} ~ ${formatMonthDay(studied[studied.length - 1].date)}` : "—"}</strong></div>
      <div><p className="cc-type-fine-print text-text-tertiary">학습일</p><strong className="cc-type-body-strong tabular-nums">{studied.length}일</strong></div>
      <div><p className="cc-type-fine-print text-text-tertiary">허용 범위 경고</p><strong className={`cc-type-body-strong tabular-nums ${warnings ? "text-primary" : ""}`}>경고 {warnings}일</strong></div>
    </div>
  </section>;
}
