# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx                # <html lang="ko">, Noto Sans KR, globals.css
│   ├── globals.css               # Tailwind + 디자인 토큰 CSS 변수 + .cc-type-* / .cc-press
│   ├── page.tsx                  # 한 페이지: GlobalNav + 계획짜기 / 계획확인 (docs/USER_FLOW.md)
│   ├── error.tsx                 # 오류 경계: 저장된 계획 지우고 다시 시작
│   └── api/extract/route.ts      # POST {url} → ExtractResponse JSON
├── components/
│   ├── ui/                       # 디자인 시스템: Button, OptionChip, IconButton, TextLink, GlobalNav, StepBar, Badge, ConfirmDialog, icons
│   ├── build/                    # 계획짜기: SourceStep, UrlStep, CurriculumEditor, PlanSettings, RestDayPicker
│   └── plan/                     # 계획 표시: PlanSummary, PlanViewTabs, PlanList, RemovedList, PlanCalendar, PlanPicker
├── types/
│   ├── curriculum.ts             # CurriculumItem, Curriculum, ExtractErrorCode, ExtractResponse
│   └── plan.ts                   # IsoDate, PlanSettings, PlanDay, Plan, PlanResult, PlanOverrides, AdjustedPlan, MergedPlan, SavedPlan
├── lib/
│   ├── date/kst.ts               # KST 날짜 유틸 (YYYY-MM-DD 문자열, 월 그리드)
│   ├── format/                   # 시간·날짜 표시 문자열
│   ├── planner/                  # 순수 함수: effort.ts, schedule.ts(buildPlan), overrides.ts(applyOverrides), merge.ts(mergePlans), summary.ts
│   ├── state/                    # presets.ts, draft-reducer.ts(목차·설정·조정), app-reducer.ts(메뉴·단계·저장 목록)
│   ├── storage/plans.ts          # localStorage 계획 목록 저장·검증·복원
│   ├── errors/messages.ts        # 오류 코드 → 사용자 문구
│   ├── url-input.ts              # 클라이언트 URL 검사, cid 추출
│   └── extract-client.ts         # 클라이언트 → /api/extract 호출
└── services/                     # 서버 전용 (클라이언트에서 import 금지)
    └── extract/
        ├── errors.ts             # ExtractError(code)
        ├── url.ts                # 입력 URL 정규화, 허용 호스트·플랫폼별 경로 검사
        ├── fetch-page.ts         # 공통 안전 요청: 허용 호스트·경로 검사, 수동 리다이렉트 최대 5회, 30초 타임아웃, UA
        ├── inflearn.ts           # 인프런 페이지 요청 + __NEXT_DATA__ 파싱
        ├── youtube.ts            # YouTube 재생목록 페이지 요청 + ytInitialData 파싱
        ├── fastcampus.ts         # 패스트캠퍼스 페이지 요청 + RSC payload(self.__next_f) 파싱
        ├── megastudy.ts          # 메가스터디 페이지 요청 + EUC-KR 디코딩 + 강의목차 표 파싱
        └── fixture-fetch.ts      # EXTRACT_FIXTURES=1용 가짜 fetch
docs/design/                      # 프로토타입(prototype.dc.html)과 디자인 토큰 원본 — 참고용, 빌드에 쓰지 않음
tests/
├── fixtures/
│   ├── inflearn/                 # 저장된 인프런 페이지 HTML
│   ├── fastcampus/biz_online_claude.html  # 저장된 패스트캠퍼스 강의 페이지
│   └── megastudy/54549.html      # 저장된 메가스터디 강의 페이지(EUC-KR 원본 바이트)
└── e2e/                          # Playwright
```
- 플랫폼별 추출기 파일을 두고, 공통 인터페이스·registry는 만들지 않는다. 안전한 요청(리다이렉트 검사·타임아웃)만 `fetch-page.ts`로 공유한다(ADR-016).

## 패턴
- 메인 화면은 상호작용이 많으므로 `page.tsx`를 Client Component로 만든다. `layout.tsx`는 Server Component.
- planner는 입력(목차·설정·overrides)만으로 결과가 정해지는 순수 함수다. 화면은 결과를 그리기만 한다.
- 컴포넌트는 데이터를 props로 받고 콜백(또는 `dispatch`)만 호출한다. 입력 중인 문자열·오류 표시·선택한 달 같은 화면 전용 상태만 컴포넌트 안에 둔다.
- "오늘"은 `page.tsx`에서 `toKstIsoDate(new Date())`로 한 번 구해 props로 내려보낸다.
- 외부 요청은 `services/`에서만 한다. 클라이언트는 `/api/extract`만 호출한다.

## 데이터 흐름
```
URL 입력 → url-input.ts: 형식·호스트 검사(INVALID_URL / UNSUPPORTED), URL에서 알 수 있는 강의 id로 중복 확인(ALREADY_PLANNED)
  → POST /api/extract {url}
      → url.ts: 정규화(trim, https 보정, m.inflearn → www, megastudy.net → www, 메가스터디 `…/lecture_detailview.asp`(/chr/, /lecmain/{메뉴}/chr_detail/ 등) → /teacher_v2/chr/, 해시 제거) + 허용 호스트·플랫폼별 경로 검사
      → hostname 정확 일치로 플랫폼별 추출기 선택: inflearn.ts / youtube.ts / fastcampus.ts / megastudy.ts
      → fetch-page.ts: GET (일반 브라우저 UA, 전체 30초 타임아웃, 수동 리다이렉트 최대 5회, 각 대상 요청 전 호스트·경로 검사)
      → 플랫폼별 파싱(__NEXT_DATA__ / ytInitialData / RSC payload / EUC-KR 표) → Curriculum
  ← {ok:true, curriculum} | {ok:false, code}
  → courseId로 중복 재확인 → app-reducer EXTRACT_SUCCESS (draft = {curriculum, settings, overrides:{}})
  → 목차·설정·조정 편집 (draft-reducer)
  → useMemo: buildPlan(curriculum, settings) → applyOverrides(result, overrides) → 화면
  → 계획하기/저장/삭제 → app-reducer가 plans 갱신 → savePlans(localStorage)

계획확인: plans 각각 buildPlan + applyOverrides → 하나 선택이면 그 결과, 전체면 mergePlans
```

## 인프런 파싱
- `<script id="__NEXT_DATA__">`의 JSON을 `JSON.parse`로 읽는다.
- `props.pageProps.dehydratedState.queries[]`에서 queryKey가 `/courses/(\d+)/curriculum` 정규식에 맞는 항목의 `state.data.data.curriculum`을 쓴다: 섹션 `{id, title, units[]}`, 수업 `{id, title, type, runtime(초)}`. 정규식의 숫자가 `courseId`.
- `type !== "LECTURE"` 수업은 버리고 버린 개수를 `droppedCount`로 센다. `runtime`이 0이면 `durationSec: null`.
- 강의명: queryKey가 `/course/\d+/online/info`에 맞는 항목의 `state.data.data.title` → 없으면 `og:title`에서 `|` 앞부분(실측 형식: `강의명| Doo it - 인프런 강의`) → 둘 다 없으면 "제목 없는 강의".
- 강사명: 같은 online/info 항목의 `state.data.data.instructors[].name`을 `, `로 이음. 없으면 null.
- 실측 fixture(introduction-to-clau, cid 344799): 섹션 4, unit 13(퀴즈 1), 영상 수업 12, runtime 합 6,385초, 강사 "Doo it".

## 패스트캠퍼스 파싱
- 강의 URL: `https://fastcampus.co.kr/{slug}`(예: `/biz_online_claude`, `www.` 유무 허용). 경로가 한 단계라 URL만으로 강의 페이지인지 판별할 수 없다. robots.txt는 `Allow: /`(2026-11-03 확인).
- Next.js App Router 페이지다. HTML의 `self.__next_f.push([1,"..."])` 문자열 조각을 JSON 문자열로 디코딩해 순서대로 이어 붙인 RSC payload에서 `"curriculum":[...]` 배열을 괄호 짝을 맞춰 잘라 `JSON.parse`로 읽는다.
- 구조: PART `{id, type:"PART", title, time, child[]}` → CHAPTER `{type:"CHAPTER", title, time, child[]}` → CLIP `{id, type:"CLIP", title, time:"00:11:44", isAppendix}`.
- CHAPTER가 섹션(level 0)이고 제목은 `{Part 제목} · {Chapter 제목}`. CLIP이 수업(level 1)이며 `isAppendix`인 CLIP도 포함한다. `time`(`HH:MM:SS`)을 초로 바꾸고, 0이거나 형식이 틀리면 `durationSec: null`.
- `courseId`: 같은 payload의 `"courseId":261444`(queryKey `getCourseById`) → `fastcampus:261444`.
- curriculum이 없거나 CLIP이 0개면 `NO_CURRICULUM`.
- 실측 fixture(biz_online_claude): courseId 261444, Part 7개, CHAPTER 16개, CLIP 51개(`isAppendix` 0개), CLIP `time` 합 43,726초(12시간 8분 46초).

## 메가스터디 파싱
- 강의 URL: `https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD={숫자}`. `megastudy.net`은 `www.megastudy.net`으로, `/chr/`, 강좌 목록 링크의 `/lecmain/{메뉴}/chr_detail/`(예: `/lecmain/mains/chr_detail/`, `/lecmain/mains/mainsgo12/chr_detail/`) 등 영문·숫자·`_` 디렉터리 아래의 `lecture_detailview.asp`는 모두 `/teacher_v2/chr/lecture_detailview.asp`로 정규화한다(`/chr/` 경로는 HTTP 200으로 본문에 `| 404`가 든 오류 페이지를 돌려준다). robots.txt는 이 경로를 막지 않는다(2026-11-03 확인).
- 서버가 만든 HTML이고 EUC-KR 인코딩이다. 응답 바이트를 `TextDecoder("euc-kr")`로 디코딩한다.
- `<p class="lstedu--subbx_tit">강의목차</p>` 바로 뒤의 `<table class="tb_char_opt">`(같은 class의 표가 여러 개 있고, `border` 등 다른 속성이 앞에 올 수 있다)의 `<tbody>` 각 `<tr>`에서 첫 `<td>`가 수업명, 마지막 `<td class="lecture-time">`이 재생시간(`56:25` 또는 `1:09:03`)이다. 가운데 `lecture-time` 칸(교재, `-`)은 쓰지 않는다.
- 섹션이 없으므로 강의명으로 가상 섹션 1개(level 0)를 만들고 모든 행을 그 아래 수업으로 둔다. OT 행도 수업으로 포함한다.
- 강의명: `<p class="lstedu_bookinfo--tit">`의 텍스트. 강사명: `<p class="lstedu_bookinfo--teacher">` 안 첫 링크 텍스트(`[제2외국어] 박수진 선생님`).
- `courseId`: `megastudy:{CHR_CD}`.
- 강의목차 표가 없거나 행이 0개면 `NO_CURRICULUM`.
- 실측 fixture(54549): CHR_CD 54549, 강의명 "중국어 어휘 폭풍성장", 표 행 21개(OT + 1~20강), 재생시간 합 61,863초(17시간 11분 3초).

## 데이터 모델 (정확한 정의는 `src/types/`)
- `CurriculumItem`: `id`(인프런 id 문자열), `title`, `level`(0 섹션 / 1 수업), `order`, `sectionId`(수업이면 소속 섹션 id, 섹션이면 null), `durationSec`(number | null), `source`(`"origin"` | `"manual"`), `excluded`(boolean)
- `Curriculum`: `title`, `sourceUrl`, `platform`(`"inflearn"` | `"youtube"` | `"book"` | `"fastcampus"` | `"megastudy"`), `courseId`(문자열: 인프런 숫자, `youtube:{list}`, `fastcampus:{courseId}`, `megastudy:{CHR_CD}`), `instructor`(string | null), `droppedCount`, `items`(평평한 목록)
- `PlanSettings`: `startDate`, `weekdayMinutes`(길이 7, 인덱스 0 = 일요일), `toleranceMinutes`, `restDates`, `lectureMultiplier`
- `PlanDay` / `Plan` / `PlanResult`: 자동 배분 결과(`buildPlan`)
- `PlanOverrides`: `Record<수업 id, IsoDate | null>` (날짜 = 직접 옮김, null = 계획에서 제외)
- `AdjustedDay`: `PlanDay` + `movedItemIds`. `AdjustedPlan`: `days`, `removedItemIds`, `baseDateById`
- `MergedDay`: `date`, `entries: {planId, itemId, effortSec}[]`, `effortSec`, `outOfRange`. `MergedPlan`: `days`
- `SavedPlan`: `id`, `curriculum`, `settings`, `overrides`, `savedAt`(ISO 문자열)
- `ExtractResponse`: `{ok:true, curriculum}` | `{ok:false, code: ExtractErrorCode}`
- `ExtractErrorCode`: `INVALID_URL` | `UNSUPPORTED` | `NOT_FOUND` | `FETCH_FAILED` | `NO_CURRICULUM`. 클라이언트 전용 `ALREADY_PLANNED`는 `ClientErrorCode = ExtractErrorCode | "ALREADY_PLANNED"`.

## 상태 관리
- 서버 상태 없음(DB 없음).
- `app-reducer`: `menu`("build" | "view"), 계획짜기 상태(`stage`, `url`, `extracting`, `errorCode`, `dupPlanId`, `site/book 안내`, `editingId`, `draft: PlanDraft | null`, `picked`), 계획확인 상태(`viewSel`, `viewTab`), `plans: SavedPlan[]`, `confirm`. 액션은 `"오늘"`·`id`·`savedAt`을 인자로 받는다(reducer 안에서 `new Date()`·난수 금지).
- `draft-reducer`: `PlanDraft = {curriculum, settings, overrides}`의 편집(제목·시간·제외, 설정, 옮기기·제외·되돌리기). `app-reducer`가 `DRAFT` 액션으로 위임한다.
- 배분 결과는 `useMemo`로 계산한 파생값이며 state·저장본에 넣지 않는다.
- 영속화: `lib/storage/plans.ts`가 `currculator:plans:v1`에 `{version:1, plans}`를 저장한다. `page.tsx`가 마운트 후 `loadPlans()`로 한 번 읽고, plans가 사용자 동작(계획하기·저장·삭제)으로 바뀐 경우에만 `savePlans`를 호출한다.
- 테스트: `EXTRACT_FIXTURES=1`이면 API 라우트가 네트워크 대신 플랫폼별 `tests/fixtures/{platform}/` 폴더를 읽는다(E2E용. 예: `inflearn/{slug}.html`, `fastcampus/{slug}.html`, `megastudy/{CHR_CD}.html`).
