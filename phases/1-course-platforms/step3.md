# Step 3: page-fetch

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (외부 요청·리다이렉트 CRITICAL 규칙)
- `/docs/ADR.md` (ADR-009 타임아웃, ADR-011, ADR-016)
- `/src/services/extract/inflearn.ts` (`fetchInflearnCurriculum`의 수동 리다이렉트 루프. 이 패턴을 참고한다)
- `/src/services/extract/inflearn.test.ts` (가짜 fetch로 리다이렉트를 테스트하는 방법)
- `/src/services/extract/url.ts` (Step 2 산출물)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

패스트캠퍼스·메가스터디 추출기가 함께 쓸 안전한 페이지 요청 함수를 TDD로 만든다. `src/services/extract/fetch-page.test.ts`를 **먼저** 작성한다.

```ts
// src/services/extract/fetch-page.ts
export interface FetchPageOptions {
  /** 요청 직전마다 호출한다(첫 URL과 모든 리다이렉트 대상). false면 요청하지 않고 UNSUPPORTED */
  isRequestable: (url: URL) => boolean;
  fetchImpl?: typeof fetch;          // 기본 fetch
  encoding?: "utf-8" | "euc-kr";     // 본문 디코딩. 기본 utf-8
  acceptLanguage?: string;           // 기본 "ko"
}
export interface FetchedPage { html: string; finalUrl: URL }
export async function fetchPage(url: URL, options: FetchPageOptions): Promise<FetchedPage>;
```

반드시 지킬 규칙:
- 첫 요청 전에 `isRequestable(url)`을 검사한다. false면 fetch를 한 번도 부르지 않고 `ExtractError("UNSUPPORTED")`를 던진다.
- `AbortSignal.timeout(FETCH_TIMEOUT_MS)` 하나를 모든 홉이 공유한다. 홉마다 새 타이머를 만들지 않는다. 상수 `FETCH_TIMEOUT_MS`, `MAX_REDIRECTS`, `FETCH_USER_AGENT`는 `inflearn.ts`에서 import한다.
- 요청 옵션은 `{ headers: { "User-Agent": FETCH_USER_AGENT, "Accept-Language": ... }, redirect: "manual", signal }`이다.
- 301/302/303/307/308이면 본문을 버리고 Location을 현재 URL 기준으로 해석한다. 다음 요청 **전에** `isRequestable`로 검사한다. false면 `UNSUPPORTED`를 던진다. 다음 경우는 `FETCH_FAILED`다: Location 없음, 잘못된 URL, 이미 방문한 URL(루프), `MAX_REDIRECTS` 초과.
- 최종 404는 `NOT_FOUND`, 2xx가 아닌 나머지는 `FETCH_FAILED`다. fetch 예외(네트워크, abort)는 `FETCH_FAILED`로 감싼다. 이미 `ExtractError`인 것은 그대로 다시 던진다.
- 2xx면 `await res.arrayBuffer()`를 `new TextDecoder(encoding)`으로 디코딩한다. `res.text()`를 쓰지 않는다. 이유: 메가스터디는 EUC-KR이라 `text()`를 쓰면 글자가 깨진다.

테스트(가짜 fetch만 사용):
- 정상 200 (utf-8)
- EUC-KR 바이트 디코딩: `tests/fixtures/megastudy/54549.html`을 Buffer로 읽어 응답 본문으로 주고, 디코딩된 문자열에 "중국어 어휘 폭풍성장"이 들어 있는지 확인한다.
- 허용된 리다이렉트 1회
- 허용되지 않은 Location이면 두 번째 fetch가 호출되지 않는다.
- Location 누락, 루프, 6회 리다이렉트
- 404 → NOT_FOUND, 500 → FETCH_FAILED, fetch reject → FETCH_FAILED
- 첫 URL이 불허면 fetch 호출 0회
- 모든 호출의 init에 `redirect: "manual"`과 같은 `signal` 객체가 들어 있다.

## Acceptance Criteria

```bash
npm run lint && npm run typecheck && npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/1-course-platforms/index.json`의 해당 step을 업데이트한다.
   - 성공: `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정을 3회 시도한 뒤에도 실패: `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입이 필요함: `"status": "blocked"`, `"blocked_reason": "구체적 사유"`를 쓰고 즉시 중단

## 금지사항

- `inflearn.ts`의 요청 루프를 `fetchPage`로 바꾸지 마라. 이유: 인프런은 locale 리다이렉트 특수 처리(커밋 fbdc556)가 있어 회귀 위험이 크다. 상수 export만 재사용한다.
- `redirect: "follow"`나 기본 리다이렉트를 쓰지 마라. 이유: Location을 요청 전에 검사해야 한다(CLAUDE.md CRITICAL).
- iconv-lite 같은 인코딩 패키지를 추가하지 마라. 이유: Node 내장 `TextDecoder("euc-kr")`로 충분하다(ADR 의존성 최소화).
- 테스트에서 실제 네트워크를 쓰지 마라. 이유: fixture와 가짜 fetch만 쓴다.
- 기존 테스트를 깨뜨리지 마라
