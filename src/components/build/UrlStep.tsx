"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { OptionChip } from "@/components/ui/OptionChip";
import { TextLink } from "@/components/ui/TextLink";
import { ERROR_MESSAGES } from "@/lib/errors/messages";
import { SITES, type SiteId } from "@/lib/state/app-reducer";
import type { ClientErrorCode } from "@/types/curriculum";

export interface UrlStepProps {
  url: string;
  site: SiteId;
  siteNotice: SiteId | null;
  extracting: boolean;
  elapsedSec: number;
  errorCode: ClientErrorCode | null;
  hasDup: boolean;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  onPickSite: (site: SiteId) => void;
  onFillSample: () => void;
  onBack: () => void;
  onOpenDup: () => void;
}

export function UrlStep(props: UrlStepProps) {
  const { url, site, siteNotice, extracting, elapsedSec, errorCode, hasDup } = props;
  const noticeLabel = siteNotice ? SITES.find((s) => s.id === siteNotice)?.label : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extracting) return; // E6: 요청 중 재제출 차단
    props.onSubmit();
  }

  return (
    <div className="mx-auto flex max-w-[980px] flex-col items-center gap-5 px-5 pb-20 pt-[clamp(48px,8vw,96px)] text-center">
      {extracting ? null : <TextLink onClick={props.onBack}>학습 자료 다시 고르기</TextLink>}
      <h1 className="cc-type-hero-display m-0 text-balance" style={{ fontSize: "clamp(34px,6vw,56px)" }}>
        강의 URL만 넣으세요.
      </h1>
      <p
        className="cc-type-lead-airy m-0 max-w-[600px] text-pretty text-text-secondary"
        style={{ fontSize: "clamp(19px,2.4vw,24px)" }}
      >
        목차를 가져와 날짜별 학습 계획으로 나눠 드립니다.
      </p>
      <div className="mt-4 flex flex-col items-center gap-[10px]">
        <span className="cc-type-caption-strong">강의 사이트</span>
        <div className="flex flex-wrap justify-center gap-2">
          {SITES.map((s) => (
            <OptionChip
              key={s.id}
              label={s.label}
              detail={s.id === "inflearn" ? undefined : "준비 중"}
              selected={s.id === site}
              onClick={() => props.onPickSite(s.id)}
            />
          ))}
        </div>
        {noticeLabel ? (
          <span className="cc-type-caption">{noticeLabel} 강의는 준비 중이에요. 지금은 인프런만 지원해요.</span>
        ) : null}
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-[640px] flex-wrap justify-center gap-3">
        <input
          type="text"
          inputMode="url"
          aria-label="강의 URL"
          value={url}
          disabled={extracting}
          onChange={(e) => props.onUrlChange(e.target.value)}
          placeholder="https://www.inflearn.com/course/..."
          autoComplete="off"
          spellCheck={false}
          className="cc-type-body h-12 min-w-0 flex-[1_1_280px] rounded-full border border-solid border-hairline bg-canvas px-[22px] text-ink disabled:text-text-tertiary"
        />
        <Button type="submit" disabled={extracting} className="h-12">
          목차 가져오기
        </Button>
      </form>
      {/* 라이브 영역은 항상 두고 내용만 바꿔야 스크린 리더가 읽는다 */}
      <div aria-live="polite">
        {extracting ? (
          <div className="cc-type-body-strong flex items-center gap-3">
            <span>강의 정보 가져오는 중…</span>
            <span className="cc-type-body tabular-nums text-text-tertiary">{elapsedSec}초</span>
          </div>
        ) : null}
      </div>
      {errorCode ? (
        <>
          <p role="alert" className="cc-type-caption m-0 max-w-[640px] text-pretty text-ink">
            {ERROR_MESSAGES[errorCode]}
          </p>
          {hasDup ? <TextLink onClick={props.onOpenDup}>계획확인에서 보기</TextLink> : null}
        </>
      ) : null}
      {extracting ? null : <TextLink onClick={props.onFillSample}>예시 강의로 해보기</TextLink>}
    </div>
  );
}
