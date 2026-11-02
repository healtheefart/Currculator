# Step 4: extract-api

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` ("데이터 흐름", "상태 관리"의 EXTRACT_FIXTURES)
- `/docs/USER_FLOW.md` (UC-02, 오류 문구)
- `/docs/ADR.md` (ADR-009, 011)
- `/src/types/curriculum.ts`, `/src/types/plan.ts`
- `/src/services/extract/url.ts`, `/src/services/extract/inflearn.ts`, `/src/services/extract/errors.ts` (Step 3 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

서버 API 라우트, 클라이언트 호출 함수, 클라이언트 URL 검사, 오류 문구를 만든다. 테스트를 먼저 작성한다.

### `src/app/api/extract/route.ts` (+ 같은 폴더 `route.test.ts`를 먼저)
```ts
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response>; // 항상 JSON: ExtractResponse
```
동작:
1. body를 JSON으로 파싱. 실패하거나 `url`이 문자열이 아니면 `{ok:false, code:"INVALID_URL"}` (HTTP 400).
2. `normalizeInputUrl`이 null이면 `INVALID_URL`(400).
3. `fetchInflearnCurriculum(url, fetchImpl)` 호출. 성공 → `{ok:true, curriculum}`(200). `ExtractError` → `{ok:false, code}` (HTTP는 UNSUPPORTED 422, NOT_FOUND 404, NO_CURRICULUM 422, FETCH_FAILED 502). 그 밖의 예외 → `FETCH_FAILED`(502).
4. `process.env.EXTRACT_FIXTURES === "1"`이면 `fetchImpl`을 fixture용 가짜로 바꾼다: 요청 URL의 pathname 마지막 slug로 `tests/fixtures/inflearn/{slug}.html`을 읽어 200 `Response`(url = 요청 URL)로 돌려주고, 파일이 없으면 404 `Response`. 이 분기는 `src/services/extract/fixture-fetch.ts`의 `createFixtureFetch(dir: string): typeof fetch`로 분리하고 테스트한다.
5. 오류 상세(stack, 원인)는 `console.error`로만 남긴다. 응답에는 code만 넣는다.

라우트 테스트(EXTRACT_FIXTURES=1로 핸들러를 직접 호출): 정상 URL → ok + 수업 12개 / 빈 body·잘못된 JSON → INVALID_URL / `https://www.udemy.com/course/x` → UNSUPPORTED / fixture 없는 slug → NOT_FOUND / 로드맵 URL → UNSUPPORTED.

### `src/lib/extract-client.ts` (+ 테스트 먼저)
```ts
export async function extractCurriculum(url: string, fetchImpl: typeof fetch = fetch): Promise<ExtractResponse>;
```
- `POST /api/extract`에 `{url}` 전송. JSON 응답이 `ExtractResponse` 모양이면 그대로 반환.
- 네트워크 예외(오프라인 등)·JSON이 아님·모양이 틀림 → `{ok:false, code:"FETCH_FAILED"}`. 예외를 밖으로 던지지 않는다.
- 성공 응답의 curriculum도 최소 모양(title·courseId 문자열, items 배열)을 확인한다. 틀리면 `FETCH_FAILED`.

### `src/lib/url-input.ts` (+ 테스트 먼저)
클라이언트에서 서버 요청 전에 쓰는 검사. `src/services/`를 import하지 말고 같은 규칙을 작게 다시 구현한다.
```ts
export const SAMPLE_COURSE_URL = "https://www.inflearn.com/course/introduction-to-clau?cid=344799";
export function checkCourseUrl(raw: string): "INVALID_URL" | "UNSUPPORTED" | null;
export function cidFromUrl(raw: string): string | null;
```
- `checkCourseUrl`: trim → 비면 `INVALID_URL` → scheme(`^[a-z][a-z0-9+.-]*://`)이 없으면 `https://` 붙임 → `new URL` 실패, `http:`/`https:`가 아님, hostname에 `.`이 없으면 `INVALID_URL` → hostname의 `m.`을 `www.`로 → `inf.run`이면 null → `www.inflearn.com`·`inflearn.com`이 아니면 `UNSUPPORTED` → pathname에서 `/(en|ja|vi)/` 접두를 뗀 뒤 `/course/`로 시작하지 않으면 `UNSUPPORTED` → null. hostname은 정확히 일치로 비교한다.
- `cidFromUrl`: 위와 같이 URL로 만든 뒤 `cid` 쿼리 값이 숫자로만 되어 있으면 그 문자열, 아니면 null.
- 테스트: 정상 URL·scheme 없음·공백·`m.`·`inf.run`·`/en/course/` → null / 빈 값·`not a url`·`localhost` → INVALID_URL / udemy·`inflearn.com.evil.com`·`/roadmaps/1` → UNSUPPORTED / cid 추출(있음·없음·숫자 아님).

### `src/lib/errors/messages.ts` (+ 테스트 먼저)
```ts
export const ERROR_MESSAGES: Record<ClientErrorCode, string>;          // docs/USER_FLOW.md "오류 문구" 첫 표 그대로
export const PLAN_FAILURE_MESSAGES: Record<PlanFailureReason, string>; // 같은 문서 두 번째 표 그대로
```
- 테스트: 모든 코드에 비어 있지 않은 문구가 있고 USER_FLOW 표와 글자가 같은지(대표 2개 이상 문자열 비교).

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

- 스트리밍(NDJSON, SSE)으로 만들지 마라. 이유: 프로토타입은 단순 JSON으로 결정했다(ADR-009).
- 응답에 오류 원문·stack·인프런 HTML을 넣지 마라. 이유: 내부 정보 노출.
- 클라이언트 코드에서 인프런 URL을 직접 fetch하지 마라. 이유: 외부 요청은 서버에서만(CLAUDE.md CRITICAL).
- `src/lib/`에서 `src/services/`를 import하지 마라. 이유: 클라이언트 번들에 서버 전용 코드가 들어간다.
- 테스트에서 실제 네트워크를 쓰지 마라. 이유: fixture만 사용.
- 사용 횟수 제한·캐시를 만들지 마라. 이유: 이후 phase 범위다.
- 기존 테스트를 깨뜨리지 마라
