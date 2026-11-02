"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GripVerticalIcon, XIcon } from "@/components/ui/icons";
import { formatDateLabel } from "@/lib/format/date";
import { formatDuration } from "@/lib/format/duration";
import type { DraftAction } from "@/lib/state/draft-reducer";
import type { IsoDate } from "@/types/plan";
import type { ViewDay } from "./view-model";

export function PlanList({ days, today, editable = false, baseDateById = {}, hasOverrides = false, onAction }: { days: ViewDay[]; today: IsoDate; editable?: boolean; baseDateById?: Record<string, IsoDate>; hasOverrides?: boolean; onAction?: (action: DraftAction) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<IsoDate | null>(null);
  const move = (itemId: string, date: IsoDate) => { onAction?.({ type: "MOVE_ITEM", itemId, date, baseDate: baseDateById[itemId] ?? null }); setSelectedId(null); setDragId(null); setOverDate(null); };
  return <div className="space-y-4">
    {editable && <div className="flex flex-wrap items-center justify-between gap-3"><p className="cc-type-caption text-text-secondary">수업을 선택한 뒤 날짜에 놓거나, 끌어서 다른 날짜로 옮기세요.</p>{hasOverrides && <button type="button" onClick={() => onAction?.({ type: "RESET_OVERRIDES" })} className="cursor-pointer text-primary">자동 배분으로 되돌리기</button>}</div>}
    {days.map((day) => <article key={day.date} onDragOver={editable ? (event) => { event.preventDefault(); setOverDate(day.date); } : undefined} onDragLeave={editable ? () => setOverDate(null) : undefined} onDrop={editable ? (event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || dragId; if (id) move(id, day.date); } : undefined} className={`grid min-w-0 gap-3 rounded-lg border bg-canvas p-4 sm:grid-cols-[minmax(112px,150px)_minmax(0,1fr)] ${day.date === today ? "bg-pearl" : ""} ${overDate === day.date ? "border-primary-focus bg-parchment" : "border-hairline"}`}>
      <div><h3 className="cc-type-body-strong tabular-nums">{formatDateLabel(day.date)}</h3><p className="cc-type-caption text-text-secondary">{formatDuration(day.effortSec)}</p>{day.date === today && <span className="cc-type-fine-print text-primary">오늘</span>}</div>
      <div className="min-w-0">
        {day.items.length ? <ul className="space-y-2">{day.items.map((item) => <li key={item.key} draggable={editable} onDragStart={editable ? (event) => { event.dataTransfer.setData("text/plain", item.itemId); setDragId(item.itemId); } : undefined} onDragEnd={editable ? () => { setDragId(null); setOverDate(null); } : undefined} className={`flex min-w-0 items-center gap-2 rounded-md p-2 ${selectedId === item.itemId ? "bg-parchment outline-2 outline-primary-focus" : "bg-pearl"} ${dragId === item.itemId ? "opacity-40" : ""}`}>
          {editable && <GripVerticalIcon size={16} />}
          {editable ? <button type="button" aria-label={`${item.title} 선택`} aria-pressed={selectedId === item.itemId} onClick={() => setSelectedId(selectedId === item.itemId ? null : item.itemId)} className="min-w-0 flex-1 cursor-pointer text-left"><span className="cc-type-fine-print block truncate text-text-tertiary">{item.label}</span><span className="block truncate">{item.title}</span></button> : <div className="min-w-0 flex-1"><span className="cc-type-fine-print block truncate text-text-tertiary">{item.label}</span><span className="block truncate">{item.title}</span></div>}
          <span className="cc-type-caption shrink-0 tabular-nums text-text-secondary">{formatDuration(item.effortSec)}</span>
          {item.moved && <span className="cc-type-fine-print shrink-0 text-primary">직접 조정</span>}
          {editable && <button type="button" aria-label="계획에서 제외" title="계획에서 제외" onClick={() => { onAction?.({ type: "REMOVE_ITEM", itemId: item.itemId }); setSelectedId(null); }} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full"><XIcon size={16} /></button>}
        </li>)}</ul> : <p className="cc-type-caption text-text-tertiary">배정된 수업 없음</p>}
        {day.outOfRange && <p className="cc-type-caption mt-3 rounded-md bg-tile p-3 text-white">허용 범위 밖 · {day.targetSec === null ? formatDuration(day.effortSec) : `목표 ${formatDuration(day.targetSec)} / 실제 ${formatDuration(day.effortSec)}`}</p>}
        {editable && selectedId && <Button variant="secondary" aria-label={`${formatDateLabel(day.date)}에 놓기`} onClick={() => move(selectedId, day.date)} className="mt-3">여기로 옮기기</Button>}
      </div>
    </article>)}
  </div>;
}
