"use client";

import { useState } from "react";
import { XIcon } from "@/components/ui/icons";
import { OptionChip } from "@/components/ui/OptionChip";
import { formatDateLabel } from "@/lib/format/date";
import type { DraftAction } from "@/lib/state/draft-reducer";
import { parseMinutes, parseMultiplier } from "@/lib/state/inputs";
import { PRESETS, PRESET_ORDER, matchPreset } from "@/lib/state/presets";
import type { IsoDate, PlanSettings as Settings } from "@/types/plan";
import { RestDayPicker } from "./RestDayPicker";

export interface PlanSettingsProps {
  settings: Settings;
  today: IsoDate;
  onAction: (a: DraftAction) => void;
}

// 화면 표시 순서: 월화수목금토일 (데이터 인덱스 0 = 일요일)
const DISPLAY_WEEKDAYS: readonly { index: number; label: string }[] = [
  { index: 1, label: "월" },
  { index: 2, label: "화" },
  { index: 3, label: "수" },
  { index: 4, label: "목" },
  { index: 5, label: "금" },
  { index: 6, label: "토" },
  { index: 0, label: "일" },
];

const SMALL_INPUT = "cc-type-body h-11 rounded-[8px] border-solid text-center tabular-nums text-ink";
const OK_BORDER = "border border-hairline";
const ERROR_BORDER = "border-2 border-ink";

type DraftKey = `min:${number}` | "tol" | "mult";

export function PlanSettings({ settings, today, onAction }: PlanSettingsProps) {
  // 입력 중인 문자열. 유효하면 바로 dispatch하고, 잘못된 값은 상태를 바꾸지 않고 문자열과 오류만 보인다.
  const [drafts, setDrafts] = useState<Partial<Record<DraftKey, string>>>({});

  const textOf = (key: DraftKey, current: string) => drafts[key] ?? current;
  const minInvalid = (index: number) => {
    const text = drafts[`min:${index}`];
    return text !== undefined && parseMinutes(text) === null;
  };
  const tolInvalid = drafts.tol !== undefined && parseMinutes(drafts.tol) === null;
  const multInvalid = drafts.mult !== undefined && parseMultiplier(drafts.mult) === null;
  const anyMinInvalid = DISPLAY_WEEKDAYS.some((w) => minInvalid(w.index));
  const noStudyDays = settings.weekdayMinutes.every((m) => m === 0);
  const selectedPreset = matchPreset(settings.weekdayMinutes);

  function change(key: DraftKey, value: string, commit: () => void) {
    setDrafts((d) => ({ ...d, [key]: value }));
    commit();
  }

  function blur(key: DraftKey, invalid: boolean) {
    if (invalid) return;
    setDrafts((d) => {
      if (d[key] === undefined) return d;
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-5">
      <h2 className="cc-type-display-lg m-0" style={{ fontSize: "clamp(28px,4vw,40px)" }}>
        일정 설정
      </h2>
      <div className="flex flex-col gap-6 rounded-[18px] border border-solid border-hairline bg-canvas p-6">
        <div className="flex flex-col gap-[10px]">
          <span className="cc-type-caption-strong">요일별 가용 시간 (분, 0 = 쉬는 요일)</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_ORDER.map((id) => (
              <OptionChip
                key={id}
                label={PRESETS[id].label}
                selected={selectedPreset === id}
                onClick={() => {
                  // 입력 중이던 요일 문자열은 모두 지운다
                  setDrafts((d) => {
                    const next: Partial<Record<DraftKey, string>> = {};
                    if (d.tol !== undefined) next.tol = d.tol;
                    if (d.mult !== undefined) next.mult = d.mult;
                    return next;
                  });
                  onAction({ type: "APPLY_PRESET", preset: id });
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-2">
            {DISPLAY_WEEKDAYS.map(({ index, label }) => {
              const key: DraftKey = `min:${index}`;
              const invalid = minInvalid(index);
              const off = settings.weekdayMinutes[index] === 0;
              return (
                <label key={index} className="flex flex-col items-stretch gap-[6px] text-center">
                  <span className="cc-type-caption text-text-secondary">{label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`${label}요일 가용 분`}
                    aria-invalid={invalid}
                    value={textOf(key, String(settings.weekdayMinutes[index]))}
                    onChange={(e) => {
                      const value = e.target.value;
                      change(key, value, () => {
                        const minutes = parseMinutes(value);
                        if (minutes !== null) onAction({ type: "SET_WEEKDAY", weekday: index, minutes });
                      });
                    }}
                    onBlur={() => blur(key, invalid)}
                    className={`${SMALL_INPUT} w-full min-w-0 px-1 ${invalid ? ERROR_BORDER : OK_BORDER} ${
                      off ? "bg-parchment" : "bg-canvas"
                    }`}
                  />
                </label>
              );
            })}
          </div>
          {noStudyDays ? <span className="cc-type-caption">학습할 요일을 하나 이상 정해 주세요.</span> : null}
          {anyMinInvalid ? (
            <span className="cc-type-caption">0~1440 사이 숫자로 입력해 주세요. 이전 값을 유지합니다.</span>
          ) : null}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
          <div className="flex flex-col gap-2">
            <span className="cc-type-caption-strong">허용 오차</span>
            <span className="cc-type-body flex items-center gap-2">
              하루 ±
              <input
                type="text"
                inputMode="numeric"
                aria-label="허용 오차 (분)"
                aria-invalid={tolInvalid}
                value={textOf("tol", String(settings.toleranceMinutes))}
                onChange={(e) => {
                  const value = e.target.value;
                  change("tol", value, () => {
                    const minutes = parseMinutes(value);
                    if (minutes !== null) onAction({ type: "SET_TOLERANCE", minutes });
                  });
                }}
                onBlur={() => blur("tol", tolInvalid)}
                className={`${SMALL_INPUT} w-16 bg-canvas ${tolInvalid ? ERROR_BORDER : OK_BORDER}`}
              />
              분까지 괜찮아요
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="cc-type-caption-strong">예상 학습시간</span>
            <span className="cc-type-body flex items-center gap-2">
              재생시간 ×
              <input
                type="text"
                inputMode="decimal"
                aria-label="재생시간 배수"
                aria-invalid={multInvalid}
                value={textOf("mult", String(settings.lectureMultiplier))}
                onChange={(e) => {
                  const value = e.target.value;
                  change("mult", value, () => {
                    const multiplier = parseMultiplier(value);
                    if (multiplier !== null) onAction({ type: "SET_MULTIPLIER", value: multiplier });
                  });
                }}
                onBlur={() => blur("mult", multInvalid)}
                className={`${SMALL_INPUT} w-16 bg-canvas ${multInvalid ? ERROR_BORDER : OK_BORDER}`}
              />
            </span>
          </div>
          <label className="flex flex-col gap-2">
            <span className="cc-type-caption-strong">시작일</span>
            <input
              type="date"
              value={settings.startDate}
              onChange={(e) => {
                if (e.target.value !== "") onAction({ type: "SET_START", date: e.target.value });
              }}
              className="cc-type-body h-11 min-w-0 rounded-[8px] border border-solid border-hairline bg-canvas px-3 text-ink"
            />
          </label>
        </div>
        {tolInvalid || multInvalid ? (
          <span className="cc-type-caption">
            오차는 0 이상, 배수는 0.5~5 사이로 입력해 주세요. 이전 값을 유지합니다.
          </span>
        ) : null}

        <div className="flex flex-col gap-[10px] border-t border-solid border-divider pt-5">
          <div className="flex flex-col gap-[2px]">
            <span className="cc-type-caption-strong">휴식일</span>
            <span className="cc-type-caption text-text-secondary">
              날짜를 눌러 휴식일로 지정하거나 해제하세요. 쉬는 요일과 시작일 이전은 고를 수 없어요.
            </span>
          </div>
          <RestDayPicker
            settings={settings}
            today={today}
            onToggle={(date) => onAction({ type: "TOGGLE_REST", date })}
          />
          {settings.restDates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {settings.restDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  aria-label="휴식일 삭제"
                  onClick={() => onAction({ type: "REMOVE_REST", date })}
                  className="cc-press cc-type-caption flex h-9 cursor-pointer items-center gap-2 rounded-full border border-solid border-hairline bg-parchment px-[14px] tabular-nums text-ink"
                >
                  {formatDateLabel(date)}
                  <XIcon size={14} className="opacity-60" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
