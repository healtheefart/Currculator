# Architecture Decision Records

## 철학
MVP 속도 최우선. 외부 의존성 최소화. 작동하는 최소 구현을 선택한다. 1인 개발이므로 테스트로 동작을 보장할 수 있는 단순한 규칙을 고른다.

---

### ADR-001: Next.js App Router + TypeScript + Tailwind
**결정**: Next.js(App Router, TypeScript strict)와 Tailwind CSS, npm을 쓴다.
**이유**: 추출(서버 라우트)과 UI를 한 저장소에서 처리하고 Vercel에 그대로 배포할 수 있다.
**트레이드오프**: 무거운 크롤링·OCR이 필요해지면 서버리스 실행 시간 제약을 받는다. 그때 해당 부분만 별도 워커로 분리한다.

### ADR-002: 배분은 클라이언트에서 순수 함수로 계산
**결정**: `src/lib/planner/`는 I/O 없는 순수 함수이며, 클라이언트에서 `useMemo`로 호출한다.
**이유**: 설정을 바꾸면 즉시 다시 계산되고, 표 기반 단위 테스트로 규칙을 검증하기 쉽다.
**트레이드오프**: 저장 기능이 붙으면 서버에서 같은 함수로 재검증해야 한다.

### ADR-003: 인프런은 페이지의 `__NEXT_DATA__`를 파싱
**결정**: 강의 페이지 HTML을 1회 요청해 `__NEXT_DATA__` → `props.pageProps.dehydratedState.queries[]` 중 queryKey `/client/api/v2/courses/{cid}/curriculum`의 `state.data.data.curriculum`을 읽는다. `course-api.inflearn.com`은 호출하지 않는다.
**이유**: 2026-11-02 확인 결과 목차(섹션 → 수업, `runtime` 초)가 페이지에 이미 들어 있어 요청 1회로 끝난다. 인프런 robots.txt는 `User-agent: *`에 `/course/`를 허용하고 `/api`를 금지하므로 이 방식이 정책에 맞다.
**트레이드오프**: 인프런 페이지 구조가 바뀌면 깨진다. fixture 계약 테스트와 주기적인 수동 확인으로 감지한다.

### ADR-004: 날짜는 Asia/Seoul `YYYY-MM-DD` 문자열
**결정**: planner와 타입은 날짜를 `YYYY-MM-DD` 문자열로만 다루고, "오늘"은 한국 시간 기준으로 계산해 주입한다.
**이유**: 서버(UTC)와 브라우저 시간대 차이로 날짜가 하루 밀리는 버그를 막는다.
**트레이드오프**: 해외 시간대 사용자를 고려하지 않는다.

### ADR-005: 허용 오차 범위 안 최근접 지점 배분
**결정**: 사용자가 요일별 가용 시간과 허용 오차 ±N분(기본 10)을 정한다. 날짜마다 목차 순서대로 쌓아 `[가용−N, 가용+N]` 안에서 가용 시간에 가장 가까운 끊는 지점을 고르고, 동률이면 짧은 쪽을 고른다. 범위 안에 지점이 없으면 가장 가까운 지점에서 끊고 "허용 범위 밖" 경고를 표시한다. 하루보다 긴 수업은 통째로 배정한다.
**이유**: 사용자가 원하는 "가용 시간에 최대한 맞춘 계획"을 예측 가능한 규칙으로 만든다. 날짜별로 앞에서부터 결정하므로 결과를 이해하기 쉽다. 기존 50% 경계 규칙과 경계 옵션 3종을 대체한다.
**트레이드오프**: 전체 기간 최적화가 아니라서 마지막 날 분량이 적거나 많을 수 있다. 수업을 쪼개지 않으므로 긴 수업은 범위를 벗어난다.

### ADR-006: 영상이 아닌 수업은 제외, 들은 수업은 사용자가 제외
**결정**: 인프런 `type !== "LECTURE"`인 수업(퀴즈 등)은 목차·배분·진도율에서 뺀다. `LECTURE`인데 `runtime`이 0이면 `durationSec: null`로 두고 사용자 입력을 요구한다. 사용자는 수업마다 "제외"를 체크해 이미 들은 수업을 배분에서 뺄 수 있다.
**이유**: 퀴즈는 학습 분량으로 보기 어렵고, 진도율 항목 수를 부풀린다.
**트레이드오프**: 퀴즈 풀이 시간이 계획에 반영되지 않는다.

### ADR-007: fixture 기반 테스트
**결정**: 자동 테스트는 `tests/fixtures/`에 저장한 실제 응답만 쓴다. 실제 사이트 확인은 `npm run dev`로 수동 확인한다(live 테스트 스크립트는 이후 phase).
**이유**: 외부 사이트 상태와 무관하게 테스트가 안정적이고, 외부 서버에 반복 요청하지 않는다.
**트레이드오프**: 사이트 구조 변경을 live 테스트를 돌릴 때까지 모른다.

### ADR-008: 0-mvp는 DB·외부 키 없이 진행
**결정**: 0-mvp는 Supabase, Anthropic API, OAuth를 쓰지 않는다. 계획은 서버에 저장하지 않고 브라우저(localStorage, ADR-010)에만 둔다.
**이유**: 계정·키가 아직 준비되지 않았고, 핵심 가치(URL → 계획)를 먼저 검증한다.
**트레이드오프**: 저장·진도 관리는 다음 phase까지 사용할 수 없다.

### ADR-009: Vercel 배포, 진행 표시, 시간 목표 폐기, 멈춤 방지 타임아웃
**결정**: 배포는 Vercel(Hobby)로 한다(다음 phase에서 CI와 함께 구성). "URL 입력 후 1분 안에 계획 표시" 목표는 두지 않는다. `/api/extract`는 단순 JSON을 돌려주고, 화면은 요청 중 "강의 정보 가져오는 중…"과 경과 초를 보여 준다. 외부 요청에는 멈춤 방지용 30초 타임아웃을 둔다.
**이유**: 속도 상한보다 진행 상황이 보이는 것이 중요하다는 결정(2026-11-02). 인프런 추출은 요청 1회(약 1초)라 프로토타입에는 스트리밍이 과하다. 타임아웃은 속도 목표가 아니라 응답 없는 서버 때문에 함수가 300초 동안 묶이는 것을 막기 위한 것이다.
**트레이드오프**: 단계가 많은 책 파이프라인이 붙을 때 NDJSON 스트리밍으로 API 형태를 바꿔야 한다.

### ADR-010: 0-mvp는 localStorage에 여러 계획을 명시적으로 저장 (2026-11-03 개정)
**결정**: `{version:1, plans: SavedPlan[]}`를 `currculator:plans:v1` 키로 저장한다. `SavedPlan`은 `{id, curriculum, settings, overrides, savedAt}`이며 배분 결과(Plan)는 저장하지 않는다. "계획하기"·"저장"·"삭제" 때만 쓰고, 읽기·첫 렌더링에서는 쓰지 않는다. 읽을 때 계획마다 필드를 검증해 새 객체로 다시 만들고, 잘못된 계획만 버린다. 렌더링 중 예외는 `error.tsx`에서 "저장된 계획 지우고 다시 시작"으로 복구한다. (이전 결정: 초안 1개 `currculator:draft:v1` 자동 저장. 배포된 적이 없어 이전 키 마이그레이션은 하지 않는다.)
**이유**: 프로토타입 디자인(2026-11-03)이 여러 강의 계획을 모아 보는 "계획확인" 메뉴를 기준으로 한다. 명시적 저장으로 바꾸면 작성 중 상태와 저장본이 섞이지 않고, 첫 렌더링에서 손상된 저장본을 덮어쓰는 문제가 없다. localStorage는 사용자가 조작할 수 있는 비신뢰 입력이다.
**트레이드오프**: 새로고침하면 작성 중인 계획이 사라진다. 기기 간 동기화가 안 된다. 로그인 phase에서 서버 저장으로 옮긴다.

### ADR-012: 1a 단계별 레이아웃, 한 페이지 안의 메뉴 상태
**결정**: 화면은 프로토타입의 1a 단계별 레이아웃을 따른다. 계획짜기·계획확인은 Next 라우트가 아니라 `src/app/page.tsx` 안의 클라이언트 상태(`useReducer`)로 전환한다. 시안 비교용 레이아웃 전환 바(1a/1b)는 만들지 않는다.
**이유**: 프로토타입과 같은 구조로 옮기면 화면·문구를 그대로 검증할 수 있다. 저장소가 localStorage뿐이라 라우트별 서버 렌더링 이점이 없다.
**트레이드오프**: 브라우저 뒤로 가기·주소 공유로 메뉴를 오갈 수 없다. 로그인·서버 저장 phase에서 `/plans/[id]` 라우트로 나눈다.

### ADR-013: 디자인 시스템 토큰 + 무채색 경고 표현
**결정**: Currculator 디자인 시스템 토큰(`docs/design/tokens/`)을 `globals.css`의 CSS 변수로 옮기고, 디자인 시스템 컴포넌트(Button, OptionChip, IconButton, TextLink, GlobalNav)를 `src/components/ui/`에 React로 다시 만든다. 포인트 색은 파랑 `#0066cc`, 글꼴은 Noto Sans KR. 경고·오류는 유채색 대신 검정 배지·굵은 검정 테두리로 표시한다. sticky 단계 바에만 backdrop blur를 쓴다. 아이콘은 lucide SVG를 인라인 컴포넌트로 옮긴다. (이전 결정: teal-700, Pretendard, amber/red 경고, blur 금지)
**이유**: 사용자가 프로토타입 디자인을 기준으로 개발하기로 결정했다(2026-11-03). 외부 UI 킷·아이콘 패키지 없이 필요한 몇 개만 직접 만드는 편이 의존성이 적다.
**트레이드오프**: 디자인 시스템이 바뀌면 토큰과 컴포넌트를 손으로 맞춰야 한다. 무채색 경고는 색 경고보다 눈에 덜 띌 수 있어 문구·배지로 보완한다.

### ADR-014: 수업 직접 조정은 overrides로 자동 배분 위에 덧씌움
**결정**: 계획 수정에서 사용자가 옮기거나 뺀 수업은 `overrides: Record<수업 id, IsoDate | null>`로만 저장하고, 화면은 `applyOverrides(buildPlan(...), overrides)`로 그린다. 원래 날짜로 옮기면 기록을 지운다. `applyOverrides`도 `src/lib/planner/`의 순수 함수다.
**이유**: 자동 배분 규칙(ADR-005)과 `buildPlan` 시그니처를 바꾸지 않고, 설정을 바꿔도 사용자가 고정한 날짜는 유지된다. "자동 배분으로 되돌리기"는 overrides를 비우기만 하면 된다.
**트레이드오프**: 설정을 크게 바꾸면 옮긴 수업이 자동 배분된 날과 겹쳐 그날이 범위 밖이 될 수 있다. 경고 배지로 보여 주고 사용자가 다시 조정한다.

### ADR-015: 강의당 계획 1개 (플랫폼별 강의 id)
**결정**: `Curriculum.courseId`(플랫폼별 강의 id. 인프런은 curriculum 쿼리 키의 숫자, 그 밖의 플랫폼은 ADR-016의 `{플랫폼}:{id}` 형식)를 저장하고, 같은 courseId의 계획이 이미 있으면 새 계획을 만들지 않고 `ALREADY_PLANNED` 안내와 "계획확인에서 보기" 링크를 보인다. 제출 전에는 URL에서 강의 id를 알 수 있으면(인프런 `cid`, YouTube `list`, 메가스터디 `CHR_CD`) 먼저 확인해 불필요한 요청을 줄인다. 패스트캠퍼스는 URL에 강의 id가 없으므로 추출 후에만 확인한다.
**이유**: 같은 강의의 계획이 여러 개면 전체 계획 보기에서 같은 수업이 겹친다. URL은 slug·cid·단축 링크 등 여러 형태라 URL 문자열보다 강의 id가 정확하다.
**트레이드오프**: 같은 강의를 다른 속도로 두 번 계획할 수 없다. 기존 계획을 수정해야 한다.

### ADR-011: 서버 fetch는 허용 호스트만 (2026-11-03 개정)
**결정**: 인프런(`www.inflearn.com`, `inflearn.com`, `inf.run`), YouTube(`www.youtube.com`, `youtube.com`, `m.youtube.com`, `music.youtube.com`), 패스트캠퍼스(`fastcampus.co.kr`, `www.fastcampus.co.kr`), 메가스터디(`www.megastudy.net`, `megastudy.net`)만 요청한다. `URL` 파싱 결과의 hostname을 이 목록과 정확히 일치로 비교하고 `https:`만 허용한다. `redirect: "manual"`로 응답을 받고 각 Location을 다음 요청 전에 검사한다. 경로는 플랫폼별로 제한한다: 인프런은 강의 경로(`/course/` 또는 locale 경로), YouTube는 `/playlist?list=`, 패스트캠퍼스는 한 단계 경로 `/{slug}`, 메가스터디는 `/teacher_v2/chr/lecture_detailview.asp?CHR_CD={숫자}`. 리다이렉트는 최대 5회, 전체 요청은 30초로 제한한다. User-Agent는 일반 브라우저 UA 상수를 쓴다. (이전 결정: 인프런 호스트 3개만)
**이유**: 서버가 사용자 입력 URL을 가져오므로 임의 호스트 요청(SSRF)을 막는 최소한의 안전장치다.
**트레이드오프**: 응답 크기 상한은 생략했다(배포 전 프로토타입). 배포 phase에서 IP 단위 요청 제한과 함께 다시 검토한다.

### ADR-016: 패스트캠퍼스·메가스터디 추가, 플랫폼별 추출기 + 공통 안전 요청
**결정**: 플랫폼마다 추출기 파일(`inflearn.ts`, `youtube.ts`, `fastcampus.ts`, `megastudy.ts`)을 두고, API 라우트가 입력 URL의 hostname을 정확히 일치로 비교해 추출기를 고른다. 공통 인터페이스·registry는 만들지 않고, 허용 호스트·경로 검사, 수동 리다이렉트(최대 5회), 30초 타임아웃, UA를 묶은 안전한 요청만 `fetch-page.ts`로 공유한다.
- 패스트캠퍼스(`https://fastcampus.co.kr/{slug}`): HTML 안의 `self.__next_f.push([1,"..."])` 문자열 조각(RSC payload)을 이어 붙여 `"curriculum":[...]`를 읽는다. 구조는 PART → CHAPTER → CLIP이다. CHAPTER를 섹션으로 쓰고 제목은 `{Part 제목} · {Chapter 제목}`으로 붙인다. CLIP은 수업이고 `isAppendix`인 CLIP도 포함한다. 재생시간은 CLIP의 `time`(`00:11:44`)을 초로 바꾼다. curriculum이 없으면 `NO_CURRICULUM`.
- 메가스터디(`https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD={숫자}`): 서버가 만든 EUC-KR HTML을 EUC-KR로 디코딩한다. `<p class="lstedu--subbx_tit">강의목차</p>` 바로 뒤의 `tb_char_opt` 표에서 행마다 첫 `<td>`를 수업명, 마지막 `<td class="lecture-time">`을 재생시간으로 읽는다. 섹션이 없으므로 강의명으로 가상 섹션 1개를 만든다. OT 행도 수업으로 포함한다. `/chr/lecture_detailview.asp`는 HTTP 200으로 404 페이지를 돌려주므로 `/teacher_v2/chr/` 경로로 정규화해 요청한다.
- `Curriculum.courseId`: 인프런은 숫자 그대로, YouTube는 `youtube:{list}`, 패스트캠퍼스는 `fastcampus:{courseId}`(RSC payload의 `"courseId"`), 메가스터디는 `megastudy:{CHR_CD}`.
- 유데미는 Cloudflare 봇 차단으로 서버 요청이 막히고, 에듀윌은 공개 페이지에 수업 목차가 없어 이번 phase에서 지원하지 않는다(2026-11-03 확인).
**이유**: 2026-11-03 실제 페이지를 확인한 결과 두 사이트 모두 요청 1회로 목차와 재생시간을 얻을 수 있고, robots.txt가 해당 경로를 막지 않는다. 플랫폼이 여럿이 되면서 SSRF 방지 요청 코드를 추출기마다 복사하면 검사가 어긋날 위험이 커지므로 요청 부분만 공유한다. 파싱 방식이 플랫폼마다 완전히 달라 공통 인터페이스는 이점이 적다.
**트레이드오프**: 두 사이트의 페이지 구조가 바뀌면 깨진다. fixture 테스트로 파싱 계약을 고정하고 수동 확인으로 감지한다. 패스트캠퍼스는 강의 URL이 한 단계 경로라서 URL만으로 강의 페이지인지 판별할 수 없다. 강의가 아닌 페이지는 요청한 뒤 `NO_CURRICULUM`으로 처리한다.
