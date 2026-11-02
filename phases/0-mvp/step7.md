# Step 7: build-steps

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOW.md` (UC-01 ~ UC-04, 오류 문구)
- `/docs/UI_GUIDE.md` (토큰, 상태 표현)
- `/docs/design/prototype.dc.html` (`isTypeStep`, `isUrlStep`, `showToc`, `showSettings` 영역의 마크업과 문구. 크므로 필요한 부분만)
- `/src/types/curriculum.ts`, `/src/types/plan.ts`
- `/src/lib/state/draft-reducer.ts`, `/src/lib/state/app-reducer.ts`, `/src/lib/state/presets.ts`, `/src/lib/state/inputs.ts` (Step 5)
- `/src/lib/planner/effort.ts`, `/src/lib/format/*`, `/src/lib/date/kst.ts` (Step 2)
- `/src/lib/errors/messages.ts`, `/src/lib/url-input.ts` (Step 4)
- `/src/components/ui/*` (Step 6)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

계획짜기 단계 화면 컴포넌트를 `src/components/build/`에 만든다. 각 컴포넌트 옆 `*.test.tsx`를 **먼저** 작성한다. 모두 `"use client"`이고 데이터는 props로 받아 콜백만 호출한다. 입력 중 문자열·오류 표시·보이는 달 같은 화면 전용 상태만 내부에 둔다. 문구는 USER_FLOW.md를 글자 그대로 쓴다.

### `SourceStep.tsx` (UC-01)
```ts
interface Props { bookNotice: boolean; onPick: (source: "course" | "book") => void; }
```
- 제목·설명·카드 2개(아이콘 MonitorPlay / BookOpen, "준비 중" 배지), bookNotice면 책 카드 2px primary-focus 테두리 + 안내 문구.

### `UrlStep.tsx` (UC-02)
```ts
interface Props {
  url: string; site: SiteId; siteNotice: SiteId | null;
  extracting: boolean; elapsedSec: number;
  errorCode: ClientErrorCode | null; hasDup: boolean;
  onUrlChange: (url: string) => void; onSubmit: () => void; onPickSite: (site: SiteId) => void;
  onFillSample: () => void; onBack: () => void; onOpenDup: () => void;
}
```
- 사이트 칩(인프런 selected, 나머지 detail "준비 중"), siteNotice 문구 "{라벨} 강의는 준비 중이에요. 지금은 인프런만 지원해요."
- 입력(`type="text"`, `inputMode="url"`, `aria-label="강의 URL"`) + "목차 가져오기" 버튼. Enter → onSubmit. extracting이면 입력·버튼 disabled, Enter 무시, "학습 자료 다시 고르기"·"예시 강의로 해보기" 숨김, `aria-live="polite"` 영역에 "강의 정보 가져오는 중…" + `{elapsedSec}초`.
- errorCode → `role="alert"` 문구(`ERROR_MESSAGES`). hasDup이면 "계획확인에서 보기" 링크.
- 검사(checkCourseUrl 등)는 이 컴포넌트에서 하지 않는다. page가 한다.

### `CurriculumEditor.tsx` (UC-03)
```ts
interface Props { curriculum: Curriculum; multiplier: number; onAction: (a: DraftAction) => void; }
```
- 머리: "인프런 · {강사명}"(없으면 "인프런"), 강의명 h1, "계획에 넣을 수업 {N}개 · 재생 {합} · 예상 {합×배수}"(포함되고 시간 있는 수업 기준, `formatDuration`).
- 안내 문구(droppedCount 0이면 앞 문장 생략), 시간 누락 상자.
- 섹션 카드(섹션 번호·이름·섹션 예상 합)와 4열 표(`36px | 1fr | 72px | 76px`): 체크박스(`aria-label="계획에 추가"`), 제목 입력, 재생 분 입력, 예상. 제외 행 스타일·배지는 UI_GUIDE "상태 표현".
- 제목: 입력할 때마다 trim 결과가 비지 않으면 바로 `EDIT_TITLE`, 비면 dispatch하지 않고 테두리 2px ink + "제목을 비울 수 없어요". blur 시 오류가 없으면 입력 상태를 지운다.
- 재생 분: `parseMinutes` 성공 시 바로 `EDIT_MINUTES`, 실패 시 오류 "0~1440 사이 분으로 입력해 주세요". 누락 수업은 빈 칸(placeholder "—").
- 375px에서 가로 스크롤이 생기지 않게 한다(제목 칸 `min-width: 0`).

### `PlanSettings.tsx` (UC-04)
```ts
interface Props { settings: PlanSettings; today: IsoDate; onAction: (a: DraftAction) => void; }
```
- 제목 "일정 설정", 카드 한 장. 프리셋 칩(PRESET_ORDER, `matchPreset`이 같으면 selected) → `APPLY_PRESET`(입력 중 요일 문자열은 모두 지움).
- 요일 7칸은 **월화수목금토일 순서**로 표시(데이터 인덱스는 0 = 일요일). 라벨 위, 입력 아래. `parseMinutes` 성공 시 `SET_WEEKDAY`. 0분 요일은 parchment 배경. 오류·모든 요일 0 문구는 USER_FLOW.md 그대로.
- 허용 오차(`parseMinutes` → `SET_TOLERANCE`), 배수(`parseMultiplier` → `SET_MULTIPLIER`), 시작일(`<input type="date">`, 값이 있을 때만 `SET_START`). 오차·배수 오류는 공통 문구 하나.
- 휴식일: `RestDayPicker` + 선택한 휴식일 칩(`formatDateLabel` + × 아이콘, `aria-label="휴식일 삭제"`) → `REMOVE_REST`.

### `RestDayPicker.tsx`
```ts
interface Props { settings: PlanSettings; today: IsoDate; onToggle: (date: IsoDate) => void; }
```
- 보이는 달은 내부 상태(기본: `monthOf(settings.startDate)`, startDate가 바뀌면 그 달로 다시 맞춤). IconButton "이전 달"/"다음 달", 가운데 "2026년 11월", 일~토 머리, `monthCells`로 칸.
- 칸은 44px 원형 `<button aria-pressed>`. 시작일 이전이거나 가용 0분 요일이면 disabled + 흐린 글자. 선택된 휴식일은 ink 배경·흰 글자. 오늘(선택 안 됨)은 1px ink 테두리.
- 테스트: 비활성 규칙, 토글 콜백, 달 이동, 시작일 변경 시 달 이동.

테스트 최소 범위: 각 콜백이 올바른 액션·값으로 호출되는지, 잘못된 입력에서 dispatch가 없고 오류 문구가 보이는지, 제외·누락·직접 입력 표시, 프리셋 aria-pressed, 요일 표시 순서, 추출 중 비활성·경과 초, 오류·중복 링크.

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
   - UI_GUIDE.md 금지 사항과 375px 가로 스크롤 없음을 지켰는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `dangerouslySetInnerHTML`을 쓰지 마라. 이유: 강의명·수업명·강사명은 외부 입력이다(CLAUDE.md CRITICAL).
- 컴포넌트 안에서 `new Date()`·`Date.now()`로 오늘을 구하지 마라. 이유: 오늘은 prop으로만 받는다.
- 컴포넌트 안에서 `buildPlan`을 호출하거나 `/api/extract`를 부르지 마라. 이유: 계산·요청은 page에서 한 번만 한다.
- 수업 추가·삭제·순서 변경 기능을 만들지 마라. 이유: 0-mvp 범위 밖이다.
- 날짜 선택기 등 외부 UI 라이브러리를 설치하지 마라. 이유: 의존성 최소화.
- 기존 테스트를 깨뜨리지 마라
