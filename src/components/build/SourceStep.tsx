"use client";

import { BookOpenIcon, MonitorPlayIcon } from "@/components/ui/icons";

export interface SourceStepProps {
  bookNotice: boolean;
  onPick: (source: "course" | "book") => void;
}

const CARD =
  "cc-press flex min-h-[168px] cursor-pointer flex-col gap-[10px] rounded-[18px] border-solid bg-canvas text-left text-ink";
// 선택 테두리 2px만큼 패딩을 1px 줄여 크기를 유지한다
const CARD_IDLE = "border border-hairline px-6 py-7";
const CARD_SELECTED = "border-2 border-primary-focus px-[23px] py-[27px]";

export function SourceStep({ bookNotice, onPick }: SourceStepProps) {
  return (
    <div className="mx-auto flex max-w-[980px] flex-col items-center gap-5 px-5 pb-20 pt-[clamp(56px,10vw,112px)] text-center">
      <h1 className="cc-type-hero-display m-0 text-balance" style={{ fontSize: "clamp(34px,6vw,56px)" }}>
        무엇으로 공부하나요?
      </h1>
      <p
        className="cc-type-lead-airy m-0 max-w-[600px] text-pretty text-text-secondary"
        style={{ fontSize: "clamp(19px,2.4vw,24px)" }}
      >
        목차를 가져올 학습 자료를 고르세요.
      </p>
      <div className="mt-4 grid w-full max-w-[640px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        <button
          type="button"
          data-selected="false"
          onClick={() => onPick("course")}
          className={`${CARD} ${CARD_IDLE}`}
        >
          <MonitorPlayIcon size={24} />
          <span className="cc-type-tagline mt-auto">강의 커리큘럼</span>
          <span className="cc-type-caption text-text-secondary">인프런 강의나 YouTube 재생목록 URL로 목차를 가져와요.</span>
        </button>
        <button
          type="button"
          data-selected={bookNotice ? "true" : "false"}
          onClick={() => onPick("book")}
          className={`${CARD} ${bookNotice ? CARD_SELECTED : CARD_IDLE}`}
        >
          <BookOpenIcon size={24} />
          <span className="cc-type-tagline mt-auto">책 목차</span>
          <span className="cc-type-caption text-text-secondary">책 제목이나 ISBN으로 목차와 페이지 정보를 찾아요.</span>
        </button>
      </div>
    </div>
  );
}
