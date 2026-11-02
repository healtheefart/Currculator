# Step 9: app-flow

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOW.md` (전체)
- `/docs/ARCHITECTURE.md` ("데이터 흐름", "상태 관리")
- `/docs/ADR.md` (ADR-010, 012, 015)
- `/docs/UI_GUIDE.md`
- `/docs/design/prototype.dc.html` (전체 마크업 순서와 `renderVals()`의 화면 조건·하단 버튼 규칙. 크므로 필요한 부분만)
- `/src/lib/state/*`, `/src/lib/storage/plans.ts` (Step 5)
- `/src/lib/extract-client.ts`, `/src/lib/url-input.ts`, `/src/lib/errors/messages.ts` (Step 4)
- `/src/lib/planner/*`, `/src/lib/date/kst.ts`, `/src/lib/format/*` (Step 2)
- `/src/components/**` (Step 6~8)
- `/playwright.config.ts` (Step 0)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

모든 조각을 한 페이지로 연결하고 E2E로 검증한다. 테스트를 먼저 작성한다.

### `src/app/page.tsx` (`"use client"`)
- `useReducer(appReducer, undefined, createInitialState)`.
- 오늘: `toKstIsoDate(new Date())`를 렌더링마다 구해도 되지만 컴포넌트에는 prop으로 넘긴다(이 파일에서만 `new Date()` 허용). id는 `crypto.randomUUID()`(없으면 `"p" + Date.now()`), savedAt은 `new Date().toISOString()`으로 이 파일에서 만들어 액션에 넣는다.
- 마운트 시 `loadPlans()` → `INIT`. `INIT` 전에는 계획확인/계획짜기 본문 대신 빈 본문(GlobalNav만)을 그려 첫 화면이 깜빡이지 않게 한다.
- 저장: `plansRevision`이 0보다 크고 이전 렌더링보다 커졌을 때만 `savePlans(plans)`. 첫 렌더링·INIT에서는 저장하지 않는다(React Strict Mode 효과 재실행 포함).
- 제출(`onSubmit`): extracting이면 무시 → `checkCourseUrl` 오류면 `SUBMIT_REJECTED` → `cidFromUrl`이 저장한 계획의 `courseId`와 같으면 `SUBMIT_REJECTED("ALREADY_PLANNED", dupPlanId)` → `EXTRACT_START` → `extractCurriculum(url)` → 성공 `EXTRACT_SUCCESS {curriculum, today}`, 실패 `EXTRACT_FAILURE {code}`. 요청 중 경과 초를 1초마다 갱신(별도 `useState`, 언마운트 시 타이머 정리).
- 단계 변경·계획하기·저장·수정 시작·메뉴 이동 시 `window.scrollTo(0, 0)`.
- 계산(`useMemo`): 
  - 계획짜기 draft: `buildPlan(curriculum, settings)` → ok면 `applyOverrides(...)` → `daysFromAdjusted`.
  - 계획확인: 계획마다 `buildPlan`+`applyOverrides`(실패한 계획은 빈 결과), 선택이 "all"이면 `mergePlans` → `daysFromMerged`, 계획 하나면 `daysFromAdjusted`.
- 화면 순서(프로토타입 그대로, 본문 `max-width 980px; padding 0 20px`, 아래 여백 96px):
  1. `GlobalNav`(active = menu).
  2. 계획짜기: `StepBar`(새 계획 4단계 / 수정 3단계 + editing 배지, reachable 규칙은 USER_FLOW.md "화면 상태"). stage에 따라 `SourceStep` / `UrlStep` / `CurriculumEditor` / `PlanSettings` / adjust(`PlanSummary` → `PlanViewTabs`("계획 수정") 안에 목록이면 `PlanList editable` + `RemovedList`, 달력이면 `PlanCalendar`).
  3. 계획확인: 계획 없으면 빈 상태. 있으면 "계획확인" + `PlanPicker`(행 sub는 USER_FLOW.md UC-05 형식) → `PlanSummary` → `PlanViewTabs`("날짜별 전체 일정" / "일정") 안에 `PlanList`(읽기 전용) 또는 `PlanCalendar`.
  4. 하단 버튼 줄(오른쪽 정렬)과 안내 문구: USER_FLOW.md UC-04·UC-05·UC-06 표 그대로. `계획하기`는 배분 실패 시 disabled + 사유 문구(`PLAN_FAILURE_MESSAGES`).
  5. `ConfirmDialog`: reset("처음부터 다시 할까요?" / "작성 중인 내용이 지워져요." / "처음부터"), delete("이 계획을 삭제할까요?" / "삭제한 계획은 되돌릴 수 없어요." / "삭제").
- 달력 `defaultMonth`: USER_FLOW.md UC-05 "첫 화면의 달" 규칙.
- 단계 화면(type·url) 제목은 가운데 정렬 hero, 나머지 화면 섹션 제목은 왼쪽 정렬(UI_GUIDE 타이포그래피).

### `src/app/error.tsx` (`"use client"`)
- "문제가 생겼어요" + "저장된 계획 지우고 다시 시작" 버튼(`clearPlans()` 후 `reset()`). 디자인 토큰 스타일.

### `src/app/page.test.tsx` (기존 테스트 교체)
- `extractCurriculum`을 `vi.mock`으로 대체하고 localStorage는 jsdom 것을 쓴다(테스트마다 clear).
- 계획 없음 → 계획짜기 type 단계. 강의 커리큘럼 → URL → 예시 강의 → 목차 가져오기 → 목차 확인 → 일정 설정 → 계획하기 → 계획확인에 그 강의가 선택되고 localStorage에 1개 저장.
- 같은 cid로 다시 시도 → 요청 없이 ALREADY_PLANNED + "계획확인에서 보기".
- 저장된 계획이 있으면 첫 화면이 계획확인, 마운트만으로는 localStorage가 바뀌지 않음(손상된 값 그대로 유지 확인).
- 계획 수정 → 수업 × → 저장 → 제외가 반영되어 저장. 수정 → 취소 → 저장본 그대로.
- 삭제 확인창 → 삭제 → 빈 상태.

### E2E `tests/e2e/home.spec.ts` (Playwright, `EXTRACT_FIXTURES=1`)
1. 새 계획: 강의 커리큘럼 → "예시 강의로 해보기" → "목차 가져오기" → 강의명과 "인프런 · Doo it" 보임 → 일정 설정 → 프리셋 "평일만 60분" → 계획하기 → 계획확인에서 강의명 선택됨, 목록에 날짜 1개 이상 → 새로고침 → 계획확인이 첫 화면이고 같은 강의가 보임.
2. 계획 수정: 수업 하나를 눌러 선택 → 다른 날짜의 "여기로 옮기기" → "직접 옮김" 표시 → 저장 → 다시 수정에서 "자동 배분으로 되돌리기" 보임.
3. 지원하지 않는 URL: `https://www.udemy.com/course/x` → "지금은 인프런 강의 페이지만 지원해요."
4. 모바일(375×812) 계획확인 달력 탭에서 `document.documentElement.scrollWidth <= 375`.

## Acceptance Criteria

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
   - docs/USER_FLOW.md의 UC-01~UC-08이 모두 동작하는가? 프로토타입과 문구·순서가 같은가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (Playwright 브라우저 실행 불가 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 배분 결과를 `useState`/reducer에 따로 저장하지 마라. 이유: `useMemo` 파생값이어야 편집과 계획이 어긋나지 않는다.
- 클라이언트 컴포넌트에서 `src/services/`를 import하지 마라. 이유: 서버 전용 코드(외부 fetch)가 번들에 들어간다.
- 첫 렌더링·INIT에서 localStorage에 쓰지 마라. 이유: 손상되었거나 다른 탭이 쓴 저장본을 덮어쓴다(ADR-010).
- 1a/1b 레이아웃 전환 바를 만들지 마라. 이유: 시안 비교용이다(ADR-012).
- `window.confirm`을 쓰지 마라. 이유: 디자인 시스템 확인창(ConfirmDialog)을 쓴다.
- E2E에서 실제 인프런에 요청하지 마라. 이유: `EXTRACT_FIXTURES=1` fixture 모드만 사용한다.
- 로그인·서버 저장·목차 직접 입력·책 추출 화면을 만들지 마라. 이유: 0-mvp 범위 밖이다.
- 기존 테스트를 깨뜨리지 마라
