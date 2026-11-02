# Step 1: core-types

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` (특히 "데이터 모델")
- `/docs/USER_FLOW.md`
- `/docs/ADR.md`
- `/package.json`, `/tsconfig.json` (Step 0 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

이후 모든 step이 공유하는 타입만 정의한다. 로직은 쓰지 않는다.

### `src/types/curriculum.ts`
```ts
export type Platform = "inflearn";
export type DurationSource = "origin" | "manual";

export interface CurriculumItem {
  id: string;              // 인프런 section/unit id 문자열
  title: string;
  level: 0 | 1;            // 0 = 섹션(묶음 제목), 1 = 수업(배정 단위)
  order: number;           // 목차 전체 순서 (0부터)
  sectionId: string | null; // 수업이면 소속 섹션 id, 섹션이면 null
  durationSec: number | null; // 수업만. 누락이면 null. 섹션은 null
  source: DurationSource;
  excluded: boolean;       // 사용자가 제외한 수업 (섹션은 항상 false)
}

export interface Curriculum {
  title: string;
  sourceUrl: string;
  platform: Platform;
  courseId: string;          // 인프런 강의 id (curriculum 쿼리 키의 숫자). 강의당 계획 1개 판단에 쓴다
  instructor: string | null; // 강사명. 여러 명이면 ", "로 이음
  droppedCount: number;      // 목차에서 뺀 영상 아닌 수업(퀴즈·과제) 수
  items: CurriculumItem[];   // 평평한 목록, 재귀 구조 금지
}

export type ExtractErrorCode =
  | "INVALID_URL" | "UNSUPPORTED" | "NOT_FOUND" | "FETCH_FAILED" | "NO_CURRICULUM";

/** 화면에서만 쓰는 오류 코드. ALREADY_PLANNED = 이미 계획을 만든 강의 */
export type ClientErrorCode = ExtractErrorCode | "ALREADY_PLANNED";

export type ExtractResponse =
  | { ok: true; curriculum: Curriculum }
  | { ok: false; code: ExtractErrorCode };
```

### `src/types/plan.ts`
```ts
export type IsoDate = string; // Asia/Seoul 기준 "YYYY-MM-DD"

/** 인덱스 0 = 일요일 … 6 = 토요일. 값은 가용 분(0 = 학습 안 함) */
export type WeekdayMinutes = [number, number, number, number, number, number, number];

export interface PlanSettings {
  startDate: IsoDate;
  weekdayMinutes: WeekdayMinutes;
  toleranceMinutes: number;
  restDates: IsoDate[];
  lectureMultiplier: number;
}

export interface PlanDay {
  date: IsoDate;
  itemIds: string[];
  effortSec: number;  // 그날 배정된 예상 학습시간 합 (초, 소수 가능)
  targetSec: number;  // 그날 가용 시간 (초)
  outOfRange: boolean; // 허용 범위 밖이면 true
}

export interface Plan {
  days: PlanDay[];
  startDate: IsoDate;
  endDate: IsoDate;
  totalEffortSec: number;
  missingItemIds: string[]; // 시간 누락으로 배분에서 빠진 수업 id
}

export type PlanFailureReason = "NO_STUDY_DAYS" | "NO_ITEMS";

export type PlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: PlanFailureReason; missingItemIds: string[] };

/** 사용자가 직접 조정한 수업. 값이 날짜면 그 날로 옮김, null이면 계획에서 제외 */
export type PlanOverrides = Record<string, IsoDate | null>;

export interface AdjustedDay extends PlanDay {
  movedItemIds: string[]; // 이 날로 직접 옮겨 온 수업 id
}

export interface AdjustedPlan {
  days: AdjustedDay[];                  // 날짜 오름차순. 수업이 모두 빠진 날도 남는다
  removedItemIds: string[];             // 계획에서 제외한 수업 id (목차 순서)
  baseDateById: Record<string, IsoDate>; // 자동 배분 기준 날짜
}

export interface MergedEntry {
  planId: string;
  itemId: string;
  effortSec: number;
}

export interface MergedDay {
  date: IsoDate;
  entries: MergedEntry[]; // 계획 저장 순서, 계획 안에서는 목차 순서
  effortSec: number;
  outOfRange: boolean;    // 그날 계획 중 하나라도 범위 밖이면 true
}

export interface MergedPlan {
  days: MergedDay[]; // 수업이 있는 날만, 날짜 오름차순
}

export interface SavedPlan {
  id: string;
  curriculum: Curriculum;
  settings: PlanSettings;
  overrides: PlanOverrides;
  savedAt: string; // ISO 8601 시각 문자열 (표시·정렬용, 날짜 계산에 쓰지 않음)
}
```

위 시그니처의 필드 이름과 의미를 바꾸지 마라. 주석은 한국어로 유지해도 된다. `plan.ts`는 `Curriculum` 타입을 `./curriculum`에서 import한다.

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

- `Date` 타입을 타입 정의에 쓰지 마라. 이유: 날짜는 KST `YYYY-MM-DD` 문자열만 쓴다(CLAUDE.md CRITICAL).
- 함수·상수 등 런타임 코드를 넣지 마라. 이유: 이 step은 타입 전용이고, TDD 가드는 types만 테스트 없이 허용한다.
- 기존 테스트를 깨뜨리지 마라
