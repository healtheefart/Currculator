"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/format/duration";
import { PLATFORM_LABELS } from "@/lib/format/platform";
import { effortSec } from "@/lib/planner/effort";
import type { DraftAction } from "@/lib/state/draft-reducer";
import { parseMinutes } from "@/lib/state/inputs";
import type { Curriculum, CurriculumItem } from "@/types/curriculum";

export interface CurriculumEditorProps {
  curriculum: Curriculum;
  multiplier: number;
  onAction: (a: DraftAction) => void;
}

const GRID = "grid grid-cols-[36px_minmax(0,1fr)_72px_76px] gap-2 px-5 py-[6px]";
const TITLE_ERROR = "제목을 비울 수 없어요";
const MINUTES_ERROR = "0~1440 사이 분으로 입력해 주세요";

function hasDuration(item: CurriculumItem): item is CurriculumItem & { durationSec: number } {
  return item.durationSec !== null && item.durationSec > 0;
}

/** 배분에 들어가는 수업(포함 + 시간 있음) */
function counts(item: CurriculumItem): boolean {
  return !item.excluded && hasDuration(item);
}

export function CurriculumEditor({ curriculum, multiplier, onAction }: CurriculumEditorProps) {
  // 입력 중인 문자열(키: "title:{id}" / "min:{id}"). 값이 유효하면 바로 dispatch하고, 표시는 이 문자열을 쓴다.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const items = [...curriculum.items].sort((a, b) => a.order - b.order);
  const sections = items.filter((i) => i.level === 0);
  const lessons = items.filter((i) => i.level === 1);

  const counted = lessons.filter(counts);
  const playSec = counted.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
  const missingCount = lessons.filter((l) => !l.excluded && !hasDuration(l)).length;

  function setDraft(key: string, value: string) {
    setDrafts((d) => ({ ...d, [key]: value }));
  }

  function clearDraft(key: string, invalid: boolean) {
    if (invalid) return; // 오류가 있으면 입력값과 문구를 유지한다
    setDrafts((d) => {
      if (!Object.hasOwn(d, key)) return d;
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  function renderLesson(lesson: CurriculumItem) {
    const titleKey = `title:${lesson.id}`;
    const minKey = `min:${lesson.id}`;
    const missing = !hasDuration(lesson);
    const titleText = Object.hasOwn(drafts, titleKey) ? drafts[titleKey] : lesson.title;
    const minText = Object.hasOwn(drafts, minKey)
      ? drafts[minKey]
      : missing
        ? ""
        : String(Math.round((lesson.durationSec ?? 0) / 60));
    const titleInvalid = Object.hasOwn(drafts, titleKey) && titleText.trim() === "";
    const minInvalid = Object.hasOwn(drafts, minKey) && parseMinutes(minText) === null;
    const error = titleInvalid ? TITLE_ERROR : minInvalid ? MINUTES_ERROR : null;
    const errorId = `lesson-error-${lesson.id}`;

    const titleBorder = titleInvalid ? "border-2 border-ink" : "border border-transparent";
    const minBorder =
      minInvalid || (missing && !lesson.excluded) ? "border-2 border-ink" : "border border-hairline";

    return (
      <div
        key={lesson.id}
        data-lesson-row
        data-excluded={lesson.excluded ? "true" : "false"}
        className={`${GRID} items-center border-t border-solid border-divider ${lesson.excluded ? "bg-pearl" : "bg-canvas"}`}
      >
        <input
          type="checkbox"
          aria-label="계획에 추가"
          checked={!lesson.excluded}
          onChange={() => onAction({ type: "TOGGLE_EXCLUDE", itemId: lesson.id })}
          className="m-0 h-[18px] w-[18px] cursor-pointer accent-primary"
        />
        <div className="flex min-w-0 flex-col gap-[2px]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <input
              type="text"
              aria-label="수업 제목"
              aria-invalid={titleInvalid}
              aria-describedby={error ? errorId : undefined}
              value={titleText}
              onChange={(e) => {
                const value = e.target.value;
                setDraft(titleKey, value);
                if (value.trim() !== "") onAction({ type: "EDIT_TITLE", itemId: lesson.id, title: value });
              }}
              onBlur={() => clearDraft(titleKey, titleInvalid)}
              className={`cc-type-body -ml-[9px] h-10 min-w-0 flex-[1_1_8rem] rounded-[8px] border-solid bg-transparent px-2 ${titleBorder} ${
                lesson.excluded ? "text-text-tertiary line-through" : "text-ink"
              }`}
            />
            {missing && !lesson.excluded ? <Badge tone="dark">시간 누락</Badge> : null}
            {lesson.source === "manual" && !missing ? <Badge tone="gray">직접 입력</Badge> : null}
          </div>
          {error ? (
            <span id={errorId} className="cc-type-fine-print pb-1 pt-[2px]">
              {error}
            </span>
          ) : null}
        </div>
        <input
          type="text"
          inputMode="numeric"
          aria-label={curriculum.platform === "book" ? "학습 시간(분)" : "재생 시간(분)"}
          aria-invalid={minInvalid}
          value={minText}
          placeholder="—"
          onChange={(e) => {
            const value = e.target.value;
            setDraft(minKey, value);
            const minutes = parseMinutes(value);
            if (minutes !== null) onAction({ type: "EDIT_MINUTES", itemId: lesson.id, minutes });
          }}
          onBlur={() => clearDraft(minKey, minInvalid)}
          className={`cc-type-body h-10 w-full min-w-0 rounded-[8px] border-solid bg-canvas text-center tabular-nums text-ink ${minBorder}`}
        />
        <span className="cc-type-caption text-right tabular-nums text-text-secondary">
          {lesson.excluded || missing ? "—" : formatDuration(effortSec(lesson.durationSec ?? 0, multiplier))}
        </span>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="cc-type-caption-strong text-text-tertiary">
          {curriculum.instructor
            ? `${PLATFORM_LABELS[curriculum.platform]} · ${curriculum.instructor}`
            : curriculum.platform === "book"
              ? "책 학습"
              : PLATFORM_LABELS[curriculum.platform]}
        </span>
        <h1 className="cc-type-display-lg m-0 text-balance" style={{ fontSize: "clamp(28px,4vw,40px)" }}>
          {curriculum.title}
        </h1>
        <span className="cc-type-caption tabular-nums text-text-secondary">
          {`계획에 넣을 ${curriculum.platform === "book" ? "목차" : "수업"} ${counted.length}개 · ${curriculum.platform === "book" ? "학습" : "재생"} ${formatDuration(playSec)} · 예상 ${formatDuration(
            effortSec(playSec, multiplier),
          )}`}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        <span className="cc-type-caption text-text-tertiary">
          {curriculum.droppedCount > 0
            ? curriculum.platform === "youtube"
              ? `정보를 가져올 수 없는 영상 ${curriculum.droppedCount}개는 건너뛰었어요. 이미 본 영상은 체크를 풀어 계획에서 빼세요.`
              : curriculum.platform === "book"
                ? `페이지 정보가 있는 목차 ${curriculum.droppedCount}개를 불러오지 못했어요. 이미 읽은 목차는 체크를 풀어 계획에서 빼세요.`
                : `퀴즈·과제 ${curriculum.droppedCount}개는 목차에서 뺐어요. 이미 들은 수업은 체크를 풀어 계획에서 빼세요.`
            : curriculum.platform === "youtube"
              ? "이미 본 영상은 체크를 풀어 계획에서 빼세요."
              : curriculum.platform === "book"
                ? "이미 읽은 목차는 체크를 풀어 계획에서 빼세요."
                : "이미 들은 수업은 체크를 풀어 계획에서 빼세요."}
        </span>
        {missingCount > 0 ? (
          <div className="cc-type-caption rounded-[18px] bg-tile px-6 py-4 text-[#fff]">
            {`${curriculum.platform === "book" ? "학습시간" : "재생시간"}이 없는 ${curriculum.platform === "book" ? "목차" : "수업"}이 ${missingCount}개 있어요. 입력하기 전까지 배분에서 빠집니다.`}
          </div>
        ) : null}
        {sections.map((section, index) => {
          const sectionLessons = lessons.filter((l) => l.sectionId === section.id);
          const sectionSec = sectionLessons
            .filter(counts)
            .reduce((sum, l) => sum + effortSec(l.durationSec ?? 0, multiplier), 0);
          return (
            <div
              key={section.id}
              data-section
              className="overflow-hidden rounded-[18px] border border-solid border-hairline bg-canvas"
            >
              <div className="flex items-baseline gap-3 px-5 py-4">
                <span className="cc-type-caption-strong flex-none text-text-tertiary">{curriculum.platform === "book" ? "책" : "섹션"} {index + 1}</span>
                <span className="cc-type-body-strong min-w-0 flex-1 break-words">{section.title}</span>
                <span className="cc-type-caption flex-none tabular-nums text-text-tertiary">
                  {formatDuration(sectionSec)}
                </span>
              </div>
              <div className={`${GRID} cc-type-fine-print border-t border-solid border-divider text-text-tertiary`}>
                <span>추가</span>
                <span>{curriculum.platform === "book" ? "목차" : "수업"}</span>
                <span className="text-center">{curriculum.platform === "book" ? "학습(분)" : "재생(분)"}</span>
                <span className="text-right">예상</span>
              </div>
              {sectionLessons.map(renderLesson)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
