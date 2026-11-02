"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { addMonths, monthCells, monthOf, weekdayOf, type YearMonth } from "@/lib/date/kst";
import { WEEKDAY_LABELS, formatDateLabel, formatMonthLabel } from "@/lib/format/date";
import type { IsoDate, PlanSettings } from "@/types/plan";

export interface RestDayPickerProps {
  settings: PlanSettings;
  today: IsoDate;
  onToggle: (date: IsoDate) => void;
}

export function RestDayPicker({ settings, today, onToggle }: RestDayPickerProps) {
  const { startDate, weekdayMinutes, restDates } = settings;
  const [month, setMonth] = useState<YearMonth>(() => monthOf(startDate));
  const [shownStart, setShownStart] = useState(startDate);
  // 시작일이 바뀌면 보이는 달을 그 달로 다시 맞춘다 (렌더링 중 상태 조정 패턴)
  if (shownStart !== startDate) {
    setShownStart(startDate);
    setMonth(monthOf(startDate));
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2">
      <div className="flex items-center gap-2">
        <IconButton label="이전 달" icon={<ChevronLeftIcon />} onClick={() => setMonth((m) => addMonths(m, -1))} />
        <span className="cc-type-body-strong flex-1 text-center tabular-nums">{formatMonthLabel(month)}</span>
        <IconButton label="다음 달" icon={<ChevronRightIcon />} onClick={() => setMonth((m) => addMonths(m, 1))} />
      </div>
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            data-testid="weekday-head"
            className="cc-type-fine-print py-1 text-center text-text-tertiary"
          >
            {label}
          </span>
        ))}
        {monthCells(month).map((date, index) => {
          if (date === null) return <span key={`blank-${index}`} aria-hidden="true" />;
          const disabled = date < startDate || !(weekdayMinutes[weekdayOf(date)] > 0);
          const selected = restDates.includes(date);
          const tone = selected ? "bg-ink text-[#fff]" : disabled ? "bg-transparent text-hairline" : "bg-transparent text-ink";
          // 오늘(선택 안 됨)은 1px ink 테두리
          const ring = date === today && !selected ? "border-ink" : "border-transparent";
          return (
            <button
              key={date}
              type="button"
              aria-pressed={selected}
              aria-label={formatDateLabel(date)}
              disabled={disabled}
              onClick={() => onToggle(date)}
              className={`cc-type-caption grid h-11 min-w-0 place-items-center rounded-full border border-solid tabular-nums ${tone} ${ring} ${
                disabled ? "cursor-default" : "cc-press cursor-pointer"
              }`}
            >
              {Number(date.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
