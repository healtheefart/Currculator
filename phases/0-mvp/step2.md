# Step 2: planner

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOW.md` (특히 "배분 규칙", "직접 조정 규칙", UC-05)
- `/docs/ADR.md` (ADR-002, 004, 005, 006, 014)
- `/docs/ARCHITECTURE.md`
- `/src/types/curriculum.ts`, `/src/types/plan.ts` (Step 1 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

날짜 유틸, 표시 포맷, 배분 엔진을 TDD로 만든다. 모두 순수 함수다. 각 파일마다 옆에 `*.test.ts`를 **먼저** 작성한다.

### `src/lib/date/kst.ts`
```ts
export function toKstIsoDate(now: Date): IsoDate;      // Date → Asia/Seoul 기준 "YYYY-MM-DD"
export function addDays(date: IsoDate, days: number): IsoDate;
export function weekdayOf(date: IsoDate): number;       // 0 = 일요일
export function isValidIsoDate(value: string): boolean;
export type YearMonth = string; // "YYYY-MM"
export function monthOf(date: IsoDate): YearMonth;          // "2026-11-03" → "2026-11"
export function addMonths(month: YearMonth, n: number): YearMonth; // "2026-12" + 1 → "2027-01", "2026-01" − 1 → "2025-12"
export function monthCells(month: YearMonth): (IsoDate | null)[];
// 일요일 시작 달력 칸. 1일 앞의 빈칸은 null, 그 뒤 1일~말일. 끝은 채우지 않는다. "2026-11"은 1일이 일요일이라 빈칸 0개 + 30칸
```
- 이 파일만 `Date`를 인자로 받을 수 있다. 문자열 날짜 계산은 UTC 기준 산술로 처리해 실행 환경 시간대와 무관해야 한다.
- 테스트: UTC `2026-11-02T14:59:59Z` → `2026-11-02`, `2026-11-02T15:00:00Z` → `2026-11-03`. 월말·연말·윤년(`2028-02-28` + 1 = `2028-02-29`). `2026-11-02`는 월요일(1). `monthCells("2026-12")`는 빈칸 2개(1일 화요일) + 31칸. `monthCells("2028-02")`는 29일까지.

### `src/lib/format/duration.ts`, `src/lib/format/date.ts`
```ts
export function formatDuration(sec: number): string; // 분 단위 반올림: 5100 → "1시간 25분", 2700 → "45분", 3600 → "1시간", 0 → "0분"
export const WEEKDAY_LABELS: readonly string[];        // ["일","월","화","수","목","금","토"]
export function formatMonthDay(date: IsoDate): string; // "2026-11-03" → "11월 3일"
export function formatDateLabel(date: IsoDate): string; // "2026-11-03" → "11월 3일 (화)"
export function formatMonthLabel(month: YearMonth): string; // "2026-11" → "2026년 11월"
```

### `src/lib/planner/effort.ts`
```ts
export function effortSec(durationSec: number, multiplier: number): number; // 반올림하지 않는다
export function toSchedulable(curriculum: Curriculum, multiplier: number): {
  schedulable: { id: string; effortSec: number }[]; // level 1, excluded=false, durationSec>0, 목차 순서
  missingIds: string[];                              // level 1, excluded=false, durationSec null 또는 0
};
```

### `src/lib/planner/schedule.ts`
```ts
export function buildPlan(curriculum: Curriculum, settings: PlanSettings): PlanResult;
```
규칙 (docs/USER_FLOW.md "배분 규칙"과 동일):
1. 학습일 = `startDate`부터 시작해 `weekdayMinutes[요일] > 0`이고 `restDates`에 없는 날.
2. 학습일마다 남은 수업을 순서대로 누적한다. 목표 `T = 가용분×60`, 범위 `[max(0, T−N×60), T+N×60]` (N = toleranceMinutes).
3. 누적 합이 범위 안에 드는 끊는 지점 중 `|합−T|`가 가장 작은 곳에서 끊는다. 동률이면 합이 작은(짧은) 쪽.
4. 범위 안 지점이 없으면 범위 밖이라도 `|합−T|`가 가장 작은 지점에서 끊고 `outOfRange: true`. 동률이면 짧은 쪽.
5. 학습일마다 최소 1개 배정한다(하루보다 긴 수업은 통째로 배정, 범위 밖이면 `outOfRange: true`).
6. 모든 요일이 0분 → `{ok:false, reason:"NO_STUDY_DAYS"}`. 배정 대상 0개 → `{ok:false, reason:"NO_ITEMS"}`. 실패에도 `missingItemIds`를 채운다.
7. `endDate` = 마지막 PlanDay의 날짜. `totalEffortSec` = 배정 대상 예상 시간 합.

필수 테스트 케이스(배수 1, 가용 60분, 오차 10분, 매일 학습 기준. 분 단위 값은 ×60초로 넣는다):
- 25·20·18·30 → 첫날 [25,20,18] (63분), 둘째 날 [30]
- 25·20·40 → 첫날 [25,20] (45분, outOfRange), 둘째 날 [40]
- 80 단일 → 첫날 [80] (outOfRange)
- 동률: 30·25·10 → 55(≤범위)와 65(≤범위) 동률 → 55에서 끊음 [30,25]
- 오차 ≥ 가용(가용 10분, 오차 20분) → 하한 0으로 처리되어 정상 동작
- 휴식일·0분 요일 건너뜀, 요일별 가용 분이 다를 때 그날 목표 사용
- 총량 보존(모든 PlanDay effortSec 합 = totalEffortSec), 목차 순서 유지, 같은 수업이 두 번 나오지 않음
- 제외·시간 누락 수업은 배정되지 않고 누락은 `missingItemIds`에 포함
- 배수 1.5 적용
- `NO_STUDY_DAYS`, `NO_ITEMS`

### `src/lib/planner/overrides.ts`
```ts
export function applyOverrides(
  plan: Plan,
  curriculum: Curriculum,
  settings: PlanSettings,
  overrides: PlanOverrides,
): AdjustedPlan;
```
규칙 (docs/USER_FLOW.md "직접 조정 규칙", ADR-014):
- `baseDateById`: `plan.days`의 모든 수업 → 자동 배분 날짜.
- `plan.days`에 없는 수업 id의 override는 무시한다(목차에서 제외된 수업, 사라진 id).
- override가 `null`이면 그 수업을 원래 날짜에서 빼고 `removedItemIds`에 넣는다(목차 순서).
- override가 날짜면 원래 날짜에서 빼고 그 날짜에 넣으며 `movedItemIds`에 기록한다. override 날짜가 `baseDateById`와 같으면 옮김이 아니다(movedItemIds에 넣지 않음). 그 날짜가 `plan.days`에 없으면 새 날을 만든다(`targetSec` = `settings.weekdayMinutes[요일]×60`).
- 각 날의 `itemIds`는 목차 순서(curriculum의 `order`)로 정렬하고 `effortSec`을 다시 더한다(수업별 예상 시간은 `effortSec(durationSec, lectureMultiplier)`).
- `outOfRange` = 수업이 1개 이상이고 합이 `[max(0, targetSec−N×60), targetSec+N×60]` 밖. 수업이 없는 날은 `false`. 비교에 `1e-9` 오차를 허용한다.
- 날짜 오름차순. 수업이 모두 빠진 날도 결과에 남긴다.
- 입력 객체를 변경하지 않는다. overrides가 비어 있으면 `plan.days`와 같은 내용(+ 빈 `movedItemIds`)을 돌려준다.
- 테스트: 빈 overrides / 다른 학습일로 옮김(양쪽 합계·경고 재계산) / 학습일이 아닌 날로 옮김(새 날 생성, 날짜 정렬) / 원래 날짜로 옮김(옮김 아님) / 제외(removedItemIds, 그날 비면 남음) / 목차 순서 정렬 / 없는 id 무시.

### `src/lib/planner/merge.ts`
```ts
export interface MergeInput { planId: string; curriculum: Curriculum; settings: PlanSettings; adjusted: AdjustedPlan; }
export function mergePlans(inputs: MergeInput[]): MergedPlan;
```
- 입력 순서(계획 저장 순서)대로 날짜별로 합친다. 수업이 없는 날은 빼고, 날짜 오름차순.
- `entries`는 계획 순서 → 그 계획의 그날 `itemIds` 순서. `effortSec`은 해당 계획 배수로 계산한 값.
- 날의 `effortSec`은 entries 합, `outOfRange`는 그날 계획 중 하나라도 `outOfRange`면 true.
- 테스트: 겹치는 날짜 합치기, 순서, 경고 OR, 빈 입력 → `{days: []}`.

### `src/lib/planner/summary.ts`
```ts
export interface PlanSummaryData { totalEffortSec: number; firstDate: IsoDate | null; lastDate: IsoDate | null; studyDays: number; warnDays: number; }
export function summarizeDays(days: { date: IsoDate; itemIds?: string[]; entries?: unknown[]; effortSec: number; outOfRange: boolean }[]): PlanSummaryData;
```
- 수업(itemIds 또는 entries)이 1개 이상인 날만 센다. 합계·첫/마지막 날·학습일 수·경고일 수. 없으면 null/0.

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

- `src/lib/planner/` 안에서 `Date`, `Date.now()`, `new Date()`, 난수, I/O를 쓰지 마라. 이유: 순수 함수여야 테스트·재사용(재조정 phase)이 가능하다(CLAUDE.md CRITICAL).
- planner에서 시간을 반올림하지 마라. 이유: 반올림은 표시(`src/lib/format/`)에서만 한다.
- 수업을 쪼개지 마라. 이유: 섹션 쪼개기는 0-mvp 범위 밖이다.
- 자동 추천·목표 종료일 모드를 만들지 마라. 이유: 이후 phase 범위다.
- 기존 테스트를 깨뜨리지 마라
