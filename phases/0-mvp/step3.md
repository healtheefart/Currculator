# Step 3: inflearn-extractor

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (특히 허용 호스트·외부 요청 CRITICAL 규칙)
- `/docs/ARCHITECTURE.md` ("인프런 파싱", "데이터 흐름")
- `/docs/USER_FLOW.md` (UC-02)
- `/docs/ADR.md` (ADR-003, 006, 011)
- `/src/types/curriculum.ts` (Step 1 산출물)
- `/tests/fixtures/inflearn/introduction-to-clau.html` (실제 인프런 페이지, 2026-11-02 저장. 크므로 `__NEXT_DATA__` 부분만 확인)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

URL 정규화·허용 호스트 검사와 인프런 페이지 요청·파싱을 TDD로 만든다. 각 파일 옆 `*.test.ts`를 **먼저** 작성한다.

### `src/services/extract/errors.ts`
```ts
export class ExtractError extends Error {
  constructor(public readonly code: ExtractErrorCode, message?: string);
}
```

### `src/services/extract/url.ts`
```ts
export const ALLOWED_HOSTS: readonly string[]; // ["www.inflearn.com", "inflearn.com", "inf.run"]
export function normalizeInputUrl(raw: string): URL | null;
// trim → scheme 없으면 "https://" 붙임 → new URL 실패 시 null → "m.inflearn.com"은 "www.inflearn.com"으로 → hash 제거
export function isAllowedHost(url: URL): boolean;   // protocol === "https:" && ALLOWED_HOSTS에 hostname이 정확히 포함
export function isInflearnCoursePath(url: URL): boolean;
// hostname이 inflearn.com/www.inflearn.com이고 pathname이 /course/{slug} 또는 /{2글자 locale}/course/{slug}
```
테스트: 예시 URL `https://www.inflearn.com/course/introduction-to-clau?cid=344799#curriculum`, `/en/course/...`, `www.inflearn.com/course/...`(scheme 없음), 앞뒤 공백, `m.inflearn.com`, `https://inf.run/abc`, 거부 케이스 `http://www.inflearn.com/...`, `https://inflearn.com.evil.com/...`, `https://www.inflearn.com@evil.com/...`, `https://evil.com/inflearn.com`, `https://www.inflearn.com/roadmaps/1`(허용 호스트지만 강의 경로 아님), 빈 문자열.

### `src/services/extract/inflearn.ts`
```ts
export const FETCH_USER_AGENT: string; // 일반 데스크톱 Chrome UA 문자열 상수
export const FETCH_TIMEOUT_MS = 30_000;
export const MAX_REDIRECTS = 5;

export function parseInflearnHtml(html: string, sourceUrl: string): Curriculum;
export async function fetchInflearnCurriculum(
  url: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Curriculum>;
```
`fetchInflearnCurriculum` 동작:
1. 첫 URL을 요청 전에 검사한다. `isAllowedHost(url)`가 아니거나, 인프런 호스트인데 `isInflearnCoursePath(url)`가 아니면 요청 없이 `ExtractError("UNSUPPORTED")`. `inf.run`은 단축 링크 경로를 허용한다.
2. 하나의 `AbortSignal.timeout(FETCH_TIMEOUT_MS)`를 전체 요청과 리다이렉트에 공유한다. 각 요청은 `fetchImpl(currentUrl, { headers: { "User-Agent": FETCH_USER_AGENT, "Accept-Language": "ko" }, redirect: "manual", signal })`로 보낸다. 자동 리다이렉트를 사용하지 않는다.
3. 301/302/303/307/308 응답이면 `Location`을 현재 URL 기준으로 해석한다. 다음 URL을 **요청 전에** `isAllowedHost`로 검사하고, 인프런 호스트라면 `isInflearnCoursePath`도 검사한다. 허용 범위 밖이면 추가 요청 없이 `UNSUPPORTED`. Location 누락·잘못된 URL·루프·5회 초과는 `FETCH_FAILED`. 30초 제한은 각 홉마다 새로 시작하지 않는다.
4. 최종 응답 URL도 인프런 강의 경로여야 한다. 최종 404 → `NOT_FOUND`, 그 밖의 2xx 아님 → `FETCH_FAILED`. fetch 자체 예외(네트워크·타임아웃) → `FETCH_FAILED`.
5. 최종 2xx 본문을 `parseInflearnHtml`로 파싱.

`parseInflearnHtml` 규칙:
- `<script id="__NEXT_DATA__" ...>`의 내용을 `JSON.parse`로 읽는다. 없거나 파싱 실패 → `NO_CURRICULUM`.
- `props.pageProps.dehydratedState.queries[]` 중 `JSON.stringify(queryKey)`가 `/\/courses\/\d+\/curriculum/`에 맞는 항목의 `state.data.data.curriculum`(섹션 배열: `{id, title, units: [{id, title, type, runtime}]}`)을 쓴다.
- 섹션 → `level 0` 항목(`durationSec: null`, `sectionId: null`), 그 아래 `type === "LECTURE"` unit → `level 1` 항목(`sectionId` = 섹션 id 문자열, `durationSec` = runtime이 양수면 그 값, 아니면 null). LECTURE가 아닌 unit(QUIZ·ASSIGNMENT 등)은 버리고 그 개수를 `droppedCount`로 센다. LECTURE가 하나도 없는 섹션은 버린다. 모든 항목 `source: "origin"`, `excluded: false`, `order`는 0부터 연속.
- 영상 수업이 0개 → `NO_CURRICULUM`.
- 강의명: queryKey가 `/\/course\/\d+\/online\/info/`에 맞는 항목의 `state.data.data.title` → 없으면 `<meta property="og:title" content="...">`에서 첫 `|` 앞부분 trim → 없으면 "제목 없는 강의".
- 강사명: 같은 online/info 항목의 `state.data.data.instructors` 배열에서 문자열 `name`만 모아 `", "`로 잇는다. 없거나 비면 `null`.
- `courseId`: curriculum 항목의 queryKey 문자열에서 `/\/courses\/(\d+)\/curriculum/`로 잡은 숫자 문자열.
- `platform: "inflearn"`, `sourceUrl`은 인자 그대로.

fixture 기대값(`introduction-to-clau.html`): 강의명 `클로드(Claude) 코워크 업무 자동화 입문편: 비개발자 직장인 실무 11가지 (회의록부터 제안서·엑셀·FAQ까지)`, level 0 항목 4개, level 1 항목 12개(퀴즈 1개 제외), level 1 `durationSec` 합 6385, 첫 섹션 제목 `시작하기: 설치부터 첫 스킬 저장까지`, `courseId` `"344799"`, `instructor` `"Doo it"`, `droppedCount` 1.

`fetchInflearnCurriculum` 테스트는 가짜 `fetchImpl`로만 한다: 정상(fixture 본문) / 404 / 500 / 예외 throw / `inf.run` → 인프런 강의 / 강의 slug → cid URL / 리다이렉트 대상이 외부 호스트 또는 인프런의 로드맵·API 경로이면 **그 대상에 요청하지 않음** / Location 누락·루프·5회 초과 / 허용 호스트 밖의 최초 URL은 fetchImpl이 **호출되지 않음** / 모든 홉에 `redirect: "manual"`과 동일한 timeout signal·UA 사용.

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

- 테스트에서 실제 인프런에 요청하지 마라. 이유: 자동 테스트는 fixture만 쓴다(CLAUDE.md CRITICAL).
- hostname 비교에 `endsWith`·`includes`·정규식 부분 일치를 쓰지 마라. 이유: `inflearn.com.evil.com` 같은 우회로 SSRF가 생긴다.
- `course-api.inflearn.com`이나 인프런 `/api` 경로를 호출하지 마라. 이유: robots.txt가 `/api`를 금지하고, 페이지 HTML만으로 충분하다(ADR-003).
- `eval`·`new Function`으로 스크립트를 해석하지 마라. 이유: 외부 입력 실행 위험. `JSON.parse`만 쓴다.
- 추출기 공통 인터페이스·registry를 만들지 마라. 이유: 플랫폼이 하나뿐인 프로토타입이다.
- fixture 파일을 수정하지 마라. 이유: 실제 응답 기준 데이터다.
- 기존 테스트를 깨뜨리지 마라
