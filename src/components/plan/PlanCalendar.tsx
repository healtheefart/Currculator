"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { addMonths, monthCells, monthOf, type YearMonth } from "@/lib/date/kst";
import { formatDateLabel, formatMonthLabel, WEEKDAY_LABELS } from "@/lib/format/date";
import { formatDuration } from "@/lib/format/duration";
import type { IsoDate } from "@/types/plan";
import type { ViewDay } from "./view-model";

export function PlanCalendar({ days, today, defaultMonth }: { days: ViewDay[]; today: IsoDate; defaultMonth: YearMonth }) {
  return <CalendarContent key={defaultMonth} days={days} today={today} defaultMonth={defaultMonth} />;
}

function CalendarContent({ days, today, defaultMonth }: { days: ViewDay[]; today: IsoDate; defaultMonth: YearMonth }) {
  const [month, setMonth] = useState(defaultMonth);
  const [selected, setSelected] = useState<IsoDate | null>(null);
  const inMonth = days.filter((day) => monthOf(day.date) === month && day.items.length);
  const activeDate = selected ?? (monthOf(today) === month && days.some((day) => day.date === today && day.items.length) ? today : inMonth[0]?.date ?? null);
  const active = days.find((day) => day.date === activeDate);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const changeMonth = (offset: number) => { setMonth(addMonths(month, offset)); setSelected(null); };
  return <section className="min-w-0 rounded-lg border border-hairline bg-canvas p-4 sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-2"><IconButton label="이전 달" icon={<ChevronLeftIcon />} onClick={() => changeMonth(-1)} /><h3 className="cc-type-tagline tabular-nums">{formatMonthLabel(month)}</h3><IconButton label="다음 달" icon={<ChevronRightIcon />} onClick={() => changeMonth(1)} /></div>
    <div className="grid grid-cols-7 border-b-2 border-ink">{WEEKDAY_LABELS.map((label) => <div key={label} className="p-2 text-center cc-type-caption text-text-secondary">{label}</div>)}</div>
    <div className="grid grid-cols-7">{monthCells(month).map((date, index) => {
      if (!date) return <div key={`blank-${index}`} className="min-w-0 border-b border-hairline" />;
      const day = byDate.get(date);
      const hasItems = Boolean(day?.items.length);
      return <button key={date} type="button" disabled={!hasItems} aria-pressed={activeDate === date && hasItems} onClick={() => setSelected(date)} className={`min-h-[84px] min-w-0 border-b border-r border-hairline p-1 text-left align-top sm:min-h-[110px] sm:p-2 ${hasItems ? "cursor-pointer" : "cursor-default bg-pearl text-text-tertiary"} ${activeDate === date && hasItems ? "bg-parchment shadow-[inset_0_0_0_2px_var(--color-primary-focus)]" : ""}`}>
        <span className={`cc-type-caption-strong block tabular-nums ${date === today ? "text-primary" : ""}`}>{Number(date.slice(8))}</span>
        {hasItems && <><span className="cc-type-fine-print block truncate tabular-nums text-text-secondary">{formatDuration(day!.effortSec)}</span>{day!.items.slice(0, 3).map((item) => <span key={item.key} className="cc-type-fine-print mt-1 block truncate rounded bg-parchment px-1">{item.title}</span>)}{day!.items.length > 3 && <span className="cc-type-fine-print">+{day!.items.length - 3}</span>}</>}
      </button>;
    })}</div>
    <p className="cc-type-caption mt-4 text-text-secondary">허용 범위 밖 · 날짜를 누르면 그날 들을 수업을 아래에 표시합니다.</p>
    {active ? <div className="mt-5 border-t border-hairline pt-5"><h4 className="cc-type-tagline">{formatDateLabel(active.date)}</h4><p className="cc-type-caption mt-1 text-text-secondary">예상 {formatDuration(active.effortSec)}</p><ol className="mt-4 space-y-2">{active.items.map((item, index) => <li key={item.key} className="flex min-w-0 gap-3 rounded-md bg-pearl p-3"><span className="tabular-nums">{index + 1}</span><span className="min-w-0 flex-1"><span className="cc-type-fine-print block truncate text-text-tertiary">{item.label}</span><span className="block truncate">{item.title}</span></span><span className="cc-type-caption tabular-nums">{formatDuration(item.effortSec)}</span></li>)}</ol>{active.outOfRange && <p className="mt-4 rounded-md bg-tile p-3 text-white">허용 범위 밖</p>}</div> : <p className="mt-5 text-text-secondary">이 달에 배정된 수업이 없어요.</p>}
  </section>;
}
