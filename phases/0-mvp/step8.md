# Step 8: plan-views

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOW.md` (UC-05, UC-06, "직접 조정 규칙")
- `/docs/UI_GUIDE.md` (상태 표현, 접근성)
- `/docs/design/prototype.dc.html` (`isViewList`, `showSummary`, `showPlan`, `showList`, `showRemoved`, `showCal` 영역. 크므로 필요한 부분만)
- `/src/types/curriculum.ts`, `/src/types/plan.ts`
- `/src/lib/planner/*`, `/src/lib/format/*`, `/src/lib/date/kst.ts` (Step 2)
- `/src/lib/state/draft-reducer.ts` (Step 5: MOVE_ITEM, REMOVE_ITEM, RESTORE_ITEM, RESET_OVERRIDES)
- `/src/components/ui/*` (Step 6), `/src/components/build/*` (Step 7, 스타일 일관성 확인)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

계획을 보여 주고 직접 조정하는 컴포넌트를 `src/components/plan/`에 만든다. 각 컴포넌트 옆 `*.test.tsx`를 **먼저** 작성한다. 모두 `"use client"`, props로만 렌더링하고 "오늘"은 `today: IsoDate` prop으로 받는다.

### 공통 표시 모델 (`src/components/plan/view-model.ts` + 테스트)
컴포넌트가 계획 하나·전체 계획을 같은 방식으로 그리도록 변환한다. 순수 함수.
```ts
export interface ViewItem { key: string; itemId: string; title: string; label: string; effortSec: number; moved: boolean; }
export interface ViewDay { date: IsoDate; items: ViewItem[]; effortSec: number; targetSec: number | null; outOfRange: boolean; }
export function daysFromAdjusted(curriculum: Curriculum, settings: PlanSettings, adjusted: AdjustedPlan): ViewDay[];
// label = 섹션 제목, key = itemId, targetSec = 그날 targetSec
export function daysFromMerged(plans: SavedPlan[], merged: MergedPlan): ViewDay[];
// label = "{강의명} · {섹션 제목}", key = "{planId}:{itemId}", moved = false, targetSec = null(전체 보기에서는 목표 문구 생략)
```

### `PlanSummary.tsx`
```ts
interface Props { title: string; planCount?: number; days: ViewDay[]; }
```
- 흰 카드(radius 18). 제목(tagline) + caption들: planCount가 있으면 "계획 {N}개", "예상 {합}", "{첫 날} ~ {마지막 날}"(`formatMonthDay`, 없으면 "—"), "학습일 {N}일", "경고 {N}일"(1 이상이면 굵게, 색은 ink). `summarizeDays`를 쓴다.

### `PlanViewTabs.tsx`
```ts
interface Props { heading: string; tab: "list" | "calendar"; onTab: (t: "list" | "calendar") => void; children: React.ReactNode; }
```
- h2 heading + OptionChip 2개 "목록"·"달력"(`aria-pressed`). children으로 현재 탭 내용을 받는다.

### `PlanList.tsx`
```ts
interface Props {
  days: ViewDay[]; today: IsoDate;
  editable?: boolean;                          // 계획 수정 adjust 단계에서만 true
  baseDateById?: Record<string, IsoDate>;
  hasOverrides?: boolean;
  onAction?: (a: DraftAction) => void;         // MOVE_ITEM / REMOVE_ITEM / RESET_OVERRIDES
}
```
- 흰 카드 안 날짜 행: 2열 그리드(`minmax(112px,150px) | 1fr`). 왼쪽 "11월 3일 (화)"·그날 합계·"오늘" 배지, 오른쪽 수업들(섹션 라벨 fine-print + 제목 + 예상) 또는 "배정된 수업 없음". 범위 밖이면 dark 배지(targetSec가 있으면 "허용 범위 밖 · 목표 {X} / 실제 {Y}", 없으면 "허용 범위 밖"). 오늘 행은 pearl 배경.
- editable일 때만:
  - 위에 안내 문구(선택 여부에 따라 두 가지, USER_FLOW.md UC-06) + hasOverrides면 "자동 배분으로 되돌리기" → `RESET_OVERRIDES`.
  - 수업 행: grip 아이콘, `draggable`, 누르면 선택/해제(`aria-pressed`, 선택 시 parchment 배경 + 2px primary-focus 테두리), moved면 "직접 옮김" 배지, × 버튼(`aria-label="계획에서 제외"`, 클릭이 행 선택으로 번지지 않게) → `REMOVE_ITEM`.
  - 수업이 선택되어 있으면 그 수업이 있는 날을 뺀 모든 날짜 행에 "여기로 옮기기"(secondary 버튼) → `MOVE_ITEM {itemId, date, baseDate: baseDateById[itemId] ?? null}` 후 선택 해제.
  - 끌어서 놓기: dragstart에서 `dataTransfer.setData("text/plain", itemId)` + 내부 dragId, dragover 대상 행 강조(parchment + outline), drop 시 다른 날이면 `MOVE_ITEM`. 끄는 수업 불투명도 0.4. dragend에서 상태 초기화.
  - 선택·드래그 상태는 컴포넌트 내부 상태다.

### `RemovedList.tsx`
```ts
interface Props { curriculum: Curriculum; settings: PlanSettings; removedItemIds: string[]; onRestore: (itemId: string) => void; }
```
- removedItemIds가 비면 렌더링하지 않는다. 카드 머리 "제외한 수업 {N}개", 행마다 섹션 라벨·제목(text-secondary)·예상·"다시 넣기" 링크.

### `PlanCalendar.tsx`
```ts
interface Props { days: ViewDay[]; today: IsoDate; defaultMonth: YearMonth; }
```
- 내부 상태: 보이는 달(초기 `defaultMonth`, prop이 바뀌면 다시 맞춤), 선택한 날짜(null = 기본 규칙).
- 머리: IconButton 이전/다음 달(제한 없음), "2026년 11월". 7열 그리드(일~토, 머리 아래 2px ink 선, 칸 hairline 테두리, 높이 `clamp(84px,12vw,132px)`).
- 칸(`<button aria-pressed>`, 빈 칸은 disabled pearl): 날짜 숫자(오늘은 primary 원·흰 글자), 범위 밖 6px 점, 오른쪽 합계(fine-print, 말줄임), 수업 제목 최대 3개(parchment 칩, 말줄임) + "+{N}". 선택 칸은 parchment 배경 + inset 2px primary-focus.
- 기본 선택: 보이는 달에 오늘이 있고 수업이 있으면 오늘, 아니면 그 달의 첫 수업 날, 없으면 선택 없음. 달을 바꾸면 선택을 기본으로.
- 범례 "허용 범위 밖 · 날짜를 누르면 그날 들을 수업이 아래에 표시됩니다."(앞에 점).
- 선택한 날 상세: "11월 3일 (화)"(tagline) + "예상 {합}", 번호 목록(번호·라벨·제목·예상), 범위 밖 배지, 수업 없으면 "이 날은 배정된 수업이 없어요."
- 375px에서 가로 스크롤이 생기지 않게 한다(`minmax(0,1fr)` 열, 칸 `min-width: 0`, 말줄임).

### `PlanPicker.tsx`
```ts
interface Props { rows: { id: "all" | string; title: string; sub: string }[]; selected: "all" | string; onSelect: (id: "all" | string) => void; }
```
- 흰 카드 `role="listbox" aria-label="저장한 계획"`, 행 `<button role="option" aria-selected>`. 선택 행은 pearl 배경 + 왼쪽 3px primary-focus 막대(`box-shadow: inset 3px 0 0`) + 오른쪽 Check 아이콘.
- 행의 sub 문구는 page가 만든다(이 컴포넌트는 그리기만).

테스트 최소 범위: view-model 변환(라벨·key·전체 보기 targetSec null), 요약 숫자, 오늘 강조, 경고 문구 두 형태, editable이 아닐 때 편집 UI 없음, 선택 → 여기로 옮기기 → MOVE_ITEM(baseDate 포함), × → REMOVE_ITEM(행 선택 안 됨), drop → MOVE_ITEM(`fireEvent.dragStart/dragOver/drop`), 되돌리기 링크 조건, RemovedList 다시 넣기, 달력 기본 달·기본 선택·달 이동 시 선택 초기화·+N, PlanPicker aria-selected.

## Acceptance Criteria

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
   - UI_GUIDE.md를 따르는가(375px 가로 스크롤 없음, 숫자 tabular-nums, 드래그 없이도 이동 가능)?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 컴포넌트 안에서 `new Date()`·`Date.now()`로 오늘을 구하지 마라. 이유: 테스트 결정성과 KST 기준 유지를 위해 오늘은 prop으로만 받는다.
- 컴포넌트 안에서 `buildPlan`·`applyOverrides`·`mergePlans`를 호출하지 마라. 이유: 계산은 page에서 `useMemo`로 한 번만 한다(`summarizeDays`·view-model 변환은 허용).
- 드래그 앤 드롭·달력 라이브러리를 설치하지 마라. 이유: 의존성 최소화. HTML5 drag 이벤트로 만든다.
- 완료 체크·진도율을 만들지 마라. 이유: 로그인 phase 범위다.
- `dangerouslySetInnerHTML`을 쓰지 마라. 이유: 외부 문자열 렌더링.
- 기존 테스트를 깨뜨리지 마라
