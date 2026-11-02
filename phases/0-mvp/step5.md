# Step 5: app-state

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOW.md` (전체. 특히 화면 상태, UC-02~UC-08)
- `/docs/ARCHITECTURE.md` ("상태 관리", "데이터 모델")
- `/docs/ADR.md` (ADR-010, 012, 014, 015)
- `/src/types/curriculum.ts`, `/src/types/plan.ts` (Step 1)
- `/src/lib/date/kst.ts` (Step 2)
- `/src/lib/url-input.ts` (Step 4)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

화면 상태(reducer 2개), 프리셋, 입력값 파서, localStorage 계획 저장소를 TDD로 만든다. 모두 React에 의존하지 않는 순수 모듈이다. 각 파일 옆 `*.test.ts`를 **먼저** 작성한다.

### `src/lib/state/presets.ts`
```ts
export type PresetId = "DAILY_60" | "WEEKDAYS_60" | "WEEKDAY60_WEEKEND120";
export const PRESET_ORDER: readonly PresetId[]; // 화면 표시 순서
export const PRESETS: Record<PresetId, { label: string; weekdayMinutes: WeekdayMinutes }>;
// 라벨: "매일 60분" / "평일만 60분" / "평일 60분·주말 120분"
// 값(일~토): [60×7] / [0,60,60,60,60,60,0] / [120,60,60,60,60,60,120]
export function createDefaultSettings(today: IsoDate): PlanSettings;
// startDate=today, DAILY_60, toleranceMinutes=10, restDates=[], lectureMultiplier=1.5
export function matchPreset(weekdayMinutes: WeekdayMinutes): PresetId | null;
```

### `src/lib/state/inputs.ts`
문자열 입력을 숫자로 바꾸는 파서. 화면은 입력 중 문자열을 따로 들고 있다가 파싱에 성공할 때만 dispatch한다.
```ts
export function parseMinutes(text: string): number | null;    // /^\s*\d+\s*$/ 이고 0~1440 → 정수, 아니면 null (요일 분, 재생 분, 허용 오차 공통)
export function parseMultiplier(text: string): number | null; // /^\s*\d*\.?\d+\s*$/ 이고 0.5~5 → 숫자, 아니면 null
```
- 테스트: `"60"`, `" 0 "`, `"1440"` 성공 / `""`, `"-1"`, `"1441"`, `"1.5"`, `"abc"` 실패. 배수 `"1.5"`, `".5"`, `"5"` 성공 / `"0.4"`, `"5.1"`, `"1,5"`, `""` 실패.

### `src/lib/state/draft-reducer.ts`
```ts
export interface PlanDraft { curriculum: Curriculum; settings: PlanSettings; overrides: PlanOverrides; }
export type DraftAction =
  | { type: "EDIT_TITLE"; itemId: string; title: string }
  | { type: "EDIT_MINUTES"; itemId: string; minutes: number }   // durationSec = minutes*60, source = "manual"
  | { type: "TOGGLE_EXCLUDE"; itemId: string }
  | { type: "SET_WEEKDAY"; weekday: number; minutes: number }   // weekday 0 = 일요일
  | { type: "APPLY_PRESET"; preset: PresetId }
  | { type: "SET_TOLERANCE"; minutes: number }
  | { type: "SET_MULTIPLIER"; value: number }
  | { type: "SET_START"; date: IsoDate }
  | { type: "TOGGLE_REST"; date: IsoDate }
  | { type: "REMOVE_REST"; date: IsoDate }
  | { type: "MOVE_ITEM"; itemId: string; date: IsoDate; baseDate: IsoDate | null } // date === baseDate면 override 삭제
  | { type: "REMOVE_ITEM"; itemId: string }   // overrides[itemId] = null
  | { type: "RESTORE_ITEM"; itemId: string }  // override 삭제
  | { type: "RESET_OVERRIDES" };
export function draftReducer(draft: PlanDraft, action: DraftAction): PlanDraft;
```
규칙:
- 잘못된 값(trim 후 빈 제목, 범위 밖·정수 아닌 분(0~1440), 범위 밖 오차(0~1440 정수)·배수(0.5~5), 잘못된 날짜, 없는 itemId, level 0 수업에 EDIT_MINUTES/TOGGLE_EXCLUDE/MOVE/REMOVE)이면 **같은 객체를 그대로 반환**한다.
- 제목은 trim해서 저장한다. 불변 업데이트(입력 객체를 변경하지 않음).
- `TOGGLE_REST`: 없으면 추가, 있으면 삭제. 목록은 중복 없이 오름차순. (시작일 이전·쉬는 요일 제한은 화면에서 막는다.)

### `src/lib/state/app-reducer.ts`
```ts
export type Menu = "build" | "view";
export type BuildStage = "type" | "url" | "edit" | "schedule" | "adjust";
export type SiteId = "inflearn" | "udemy" | "class101" | "fastcampus";
export const SITES: readonly { id: SiteId; label: string }[]; // 인프런, Udemy, 클래스101, 패스트캠퍼스

export interface BuildState {
  stage: BuildStage;
  url: string;
  extracting: boolean;
  errorCode: ClientErrorCode | null;
  dupPlanId: string | null;        // ALREADY_PLANNED일 때 기존 계획 id
  siteNotice: SiteId | null;       // 준비 중 사이트를 눌렀을 때
  bookNotice: boolean;             // 책 목차를 눌렀을 때
  editingId: string | null;        // 수정 중인 SavedPlan id (새 계획이면 null)
  draft: PlanDraft | null;
}
export interface AppState {
  menu: Menu;
  plans: SavedPlan[];
  plansRevision: number;           // 사용자 동작으로 plans가 바뀔 때만 1 증가 → page가 저장
  build: BuildState;
  view: { selected: "all" | string; tab: "list" | "calendar" };
  confirm: null | { kind: "reset" } | { kind: "delete"; planId: string };
}
export function createInitialState(): AppState; // menu "build", plans [], plansRevision 0, build 초기값(stage "type"), view {selected:"all", tab:"list"}, confirm null

export type AppAction =
  | { type: "INIT"; plans: SavedPlan[] }                      // 저장본 적용. plans가 있으면 menu "view". plansRevision 그대로
  | { type: "NAVIGATE"; menu: Menu }
  | { type: "PICK_SOURCE"; source: "course" | "book" }        // course → stage "url", book → bookNotice true
  | { type: "BACK_TO_TYPE" }                                  // 추출 중이면 무시. stage "type", 오류 지움
  | { type: "PICK_SITE"; site: SiteId }                       // inflearn → siteNotice null, 그 밖 → siteNotice = site
  | { type: "SET_URL"; url: string }                          // 오류·dupPlanId 지움
  | { type: "FILL_SAMPLE" }                                   // url = SAMPLE_COURSE_URL, 오류 지움
  | { type: "SUBMIT_REJECTED"; code: ClientErrorCode; dupPlanId?: string }
  | { type: "EXTRACT_START" }
  | { type: "EXTRACT_FAILURE"; code: ClientErrorCode }
  | { type: "EXTRACT_SUCCESS"; curriculum: Curriculum; today: IsoDate }
  | { type: "GO_STAGE"; stage: BuildStage }
  | { type: "DRAFT"; action: DraftAction }
  | { type: "CREATE_PLAN"; id: string; savedAt: string }
  | { type: "START_EDIT"; planId: string }
  | { type: "SAVE_EDIT"; savedAt: string }
  | { type: "CANCEL_EDIT" }
  | { type: "ASK_RESET" } | { type: "ASK_DELETE"; planId: string } | { type: "CANCEL_CONFIRM" } | { type: "CONFIRM" }
  | { type: "SELECT_PLAN"; selected: "all" | string }
  | { type: "SET_TAB"; tab: "list" | "calendar" }
  | { type: "OPEN_DUP" };                                     // menu "view", selected = dupPlanId, 오류 지움
export function appReducer(state: AppState, action: AppAction): AppState;
```
규칙:
- `EXTRACT_START`: 이미 extracting이면 그대로. `EXTRACT_SUCCESS`: extracting 해제. `plans`에 같은 `curriculum.courseId`가 있으면 `errorCode "ALREADY_PLANNED"` + `dupPlanId`로 url 단계에 머문다. 아니면 `draft = {curriculum, settings: createDefaultSettings(today), overrides: {}}`, stage "edit".
- `GO_STAGE`: draft가 없으면 "type"·"url"만(추출 중이면 무시, "url"은 현재가 url일 때만), draft가 있으면 새 계획은 "edit"·"schedule"만, 수정 중이면 "edit"·"schedule"·"adjust"만 허용. 그 밖은 같은 state.
- `DRAFT`: draft가 없으면 무시. `draftReducer` 결과가 같은 객체면 같은 state를 돌려준다.
- `CREATE_PLAN`: draft가 있고 editingId가 null일 때만. `plans` 끝에 `{id, curriculum, settings, overrides, savedAt}` 추가, `plansRevision + 1`, menu "view", `view.selected = id`, build 초기화.
- `START_EDIT`: 그 계획을 **깊은 복사**해 draft로, `editingId`, stage "adjust", menu "build".
- `SAVE_EDIT`: editingId 계획을 draft 내용 + savedAt으로 바꾸고(순서 유지), `plansRevision + 1`, menu "view", selected = 그 id, build 초기화. `CANCEL_EDIT`: build 초기화, menu "view".
- `CONFIRM`: reset이면 build 초기화(menu 유지). delete면 그 계획 삭제, `plansRevision + 1`, selected "all". 둘 다 confirm null.
- `SELECT_PLAN`에 없는 id → "all".
- reducer 안에서 `Date`·`Date.now()`·난수를 쓰지 않는다. id·savedAt·today는 액션으로 받는다.
- 테스트: 각 액션의 정상·무시 케이스, 중복 강의(EXTRACT_SUCCESS → ALREADY_PLANNED), 수정 → 저장 시 다른 계획 불변·순서 유지, 수정 취소 시 저장본 불변(깊은 복사 확인: draft 편집 후 plans 객체가 그대로), plansRevision이 사용자 동작에서만 증가.

### `src/lib/storage/plans.ts`
```ts
export const PLANS_KEY = "currculator:plans:v1";
export function loadPlans(storage?: Storage | null): SavedPlan[];
export function savePlans(plans: SavedPlan[], storage?: Storage | null): boolean; // 성공 여부
export function clearPlans(storage?: Storage | null): void;
```
- 저장 형식: `{version: 1, plans}`. `storage` 기본값은 `globalThis.localStorage`(없거나 접근이 throw하면 null). 모든 접근을 try/catch로 감싸고 **예외를 밖으로 던지지 않는다**.
- `loadPlans`: 깨진 JSON·version ≠ 1·plans가 배열 아님 → `[]`. 계획마다 검증해 **틀린 계획만 버린다**: id(비어 있지 않은 문자열, 중복이면 뒤의 것 버림), savedAt 문자열, curriculum(title·sourceUrl·courseId 문자열, platform "inflearn", instructor 문자열|null, droppedCount 0 이상 정수, items 각 필드 타입·level 0|1·durationSec 양수|0|null), settings(날짜 형식, 길이 7·0~1440 정수 배열, tolerance 0~1440 정수, multiplier 0.5~5, restDates 날짜 배열), overrides(값이 날짜 또는 null인 객체). 통과하면 필요한 필드만 골라 **새 객체로 다시 만든다**(`__proto__` 등 다른 키는 버린다).
- 테스트: 왕복 / 깨진 JSON / version 2 / 계획 하나만 잘못됨(나머지 유지) / overrides 값 오류 / weekdayMinutes 길이 6 / 추가 키 제거 / storage가 throw / storage null / 이전 키 `currculator:draft:v1`은 읽지 않음.

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
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 배분 결과(Plan, AdjustedPlan)를 state나 저장본에 넣지 마라. 이유: `buildPlan`·`applyOverrides`로 계산하는 파생값이다(ARCHITECTURE).
- localStorage에서 읽은 객체를 spread·`Object.assign`으로 그대로 병합하지 마라. 이유: 조작된 값이 검증 없이 들어온다.
- reducer 안에서 `new Date()`·`Date.now()`·`Math.random()`·`crypto.randomUUID()`를 쓰지 마라. 이유: 순수 함수여야 테스트가 결정적이다. 값은 액션으로 주입한다.
- reducer 안에서 localStorage를 읽거나 쓰지 마라. 이유: 저장은 page가 `plansRevision`을 보고 한다.
- React 훅·컴포넌트를 만들지 마라. 이유: 이 step은 순수 모듈 범위다.
- 기존 테스트를 깨뜨리지 마라
