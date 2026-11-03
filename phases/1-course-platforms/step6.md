# Step 6: extract-api

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` ("데이터 흐름", EXTRACT_FIXTURES 설명)
- `/src/app/api/extract/route.ts`
- `/src/services/extract/fixture-fetch.ts`, `/src/services/extract/fixture-fetch.test.ts`
- `/src/services/extract/url.ts`, `/src/services/extract/inflearn.ts`, `/src/services/extract/youtube.ts`, `/src/services/extract/fastcampus.ts`, `/src/services/extract/megastudy.ts` (Step 2~5 산출물)
- `/tests/e2e/` (fixture 모드 E2E가 인프런 fixture를 어떻게 쓰는지)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

TDD로 진행한다. `src/app/api/extract/route.test.ts`(없으면 새로 만든다)와 `fixture-fetch.test.ts`를 **먼저** 고친다.

### `src/app/api/extract/route.ts`
- `normalizeInputUrl` 뒤에 hostname **정확 일치**로 추출기를 고른다.
  - 인프런 호스트(`www.inflearn.com`, `inflearn.com`, `inf.run`) → `fetchInflearnCurriculum`
  - YouTube 호스트 4개 → `fetchYouTubePlaylist`
  - `fastcampus.co.kr`, `www.fastcampus.co.kr` → `fetchFastcampusCurriculum`
  - `www.megastudy.net` → `fetchMegastudyCurriculum`
  - 그 밖의 호스트 → 요청 없이 `UNSUPPORTED`(422)
- 호스트 목록은 `url.ts`에서 export한 상수를 쓴다. 필요하면 `url.ts`에 플랫폼별 호스트 배열을 export한다. route 안에 문자열을 다시 적지 않는다.
- 지금 있는 `url.hostname.endsWith("youtube.com")` 분기를 없앤다. 이유: CLAUDE.md CRITICAL 위반이다.
- 모든 추출기에 `pickFetch()` 결과를 넘긴다. 지금 YouTube는 실제 `fetch`를 받고 있어 fixture 모드에서도 외부에 요청한다.

### `src/services/extract/fixture-fetch.ts`
- `createFixtureFetch(rootDir)`의 rootDir을 `tests/fixtures`로 바꾼다. 요청 hostname으로 하위 폴더를 고른다.
  - 인프런 → `inflearn/{pathname 마지막 조각}.html`
  - 패스트캠퍼스 → `fastcampus/{slug}.html`
  - 메가스터디 → `megastudy/{CHR_CD}.html`
  - YouTube·기타 → 404
- 기존 `SAFE_SLUG` 검사를 유지한다. 파일은 **바이트 그대로**(`readFile` 인코딩 인자 없이) 응답 본문에 넣는다. EUC-KR fixture가 깨지지 않게 하려는 것이다. `Content-Type` charset은 메가스터디면 `euc-kr`로 둔다.
- route의 `pickFetch`를 새 rootDir에 맞춘다.

### 테스트
- `route.test.ts`
  - `EXTRACT_FIXTURES=1`로 설정하고 POST를 직접 호출한다.
  - 패스트캠퍼스 fixture URL → 200, platform `fastcampus`
  - 메가스터디 `/chr/` URL(정규화됨) → 200, 강의명 확인
  - 인프런 fixture → 200(회귀)
  - `https://youtube.com.evil.com/playlist?list=x` → 422 UNSUPPORTED
  - `https://www.udemy.com/course/x` → 422
  - 잘못된 body → 400
- `fixture-fetch.test.ts`
  - 플랫폼별 폴더 선택
  - 메가스터디 바이트 보존(TextDecoder euc-kr로 "중국어 어휘 폭풍성장" 확인)
  - 경로 이동 문자(`..`) 차단

## Acceptance Criteria

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. E2E의 기존 인프런 흐름이 그대로 통과해야 한다.
2. 아키텍처 체크리스트를 확인한다.
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (`grep -rn "endsWith\|includes(" src/app/api src/services/extract`로 호스트 비교를 확인한다)
3. 결과에 따라 `phases/1-course-platforms/index.json`의 해당 step을 업데이트한다.
   - 성공: `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정을 3회 시도한 뒤에도 실패: `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입이 필요함: `"status": "blocked"`, `"blocked_reason": "구체적 사유"`를 쓰고 즉시 중단

## 금지사항

- 응답 JSON에 오류 원문·stack·외부 HTML을 넣지 마라. 이유: 내부 정보 노출. `{ok:false, code}`만 돌려준다.
- 추출기 registry·맵 기반 플러그인 구조를 만들지 마라. 이유: ADR-016. 명시적인 if 분기로 충분하다.
- 테스트에서 실제 네트워크를 쓰지 마라. 이유: CLAUDE.md CRITICAL.
- 기존 테스트를 깨뜨리지 마라
