# Step 5: megastudy-extractor

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` ("메가스터디 파싱", "데이터 모델")
- `/docs/ADR.md` (ADR-016)
- `/src/types/curriculum.ts`
- `/src/services/extract/youtube.ts` (섹션 없는 목록을 가상 섹션 1개로 만드는 방식)
- `/src/services/extract/fetch-page.ts`, `/src/services/extract/url.ts`, `/src/services/extract/fastcampus.ts` (Step 2~4 산출물)
- `/tests/fixtures/megastudy/54549.html`. **EUC-KR 바이트**라서 Read 도구로 읽으면 글자가 깨진다. `node -e 'const s=new TextDecoder("euc-kr").decode(require("fs").readFileSync("tests/fixtures/megastudy/54549.html")); const i=s.indexOf("tb_char_opt"); console.log(s.slice(i-200,i+3000))'`처럼 디코딩해서 확인한다. `lstedu_bookinfo--tit` 주변도 같은 방식으로 본다.

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

TDD로 진행한다. `src/services/extract/megastudy.test.ts`를 **먼저** 작성한다. fixture는 `readFileSync` + `TextDecoder("euc-kr")`로 디코딩해 파서에 넘긴다.

```ts
// src/services/extract/megastudy.ts
export function parseMegastudyHtml(html: string, sourceUrl: string, courseCode: string): Curriculum;
export async function fetchMegastudyCurriculum(url: URL, fetchImpl: typeof fetch = fetch): Promise<Curriculum>;
```

### 변환 규칙
- 오류 페이지 판별: `<table class="tb_char_opt">`가 없고 본문에 `| 404`가 있으면 `ExtractError("NOT_FOUND")`. 표가 없는 그 밖의 경우는 `NO_CURRICULUM`.
- 페이지에는 `tb_char_opt` 표가 여러 개(강좌정보 등) 있다. 강의목차 표는 `<p class="lstedu--subbx_tit">강의목차</p>` 바로 뒤의 표다(`<div id="scrollTab2">` 안, 헤더 `강의명/맛보기/교재/시간`). 이 제목이 없으면 위 오류 페이지 규칙을 적용한다.
- 강의목차 표의 `<tbody>` 안 각 `<tr>`:
  - 수업명 = 첫 `<td>`의 텍스트. 태그를 제거하고 공백을 정리한 뒤 HTML 엔티티를 디코딩한다.
  - 시간 = 마지막 `<td class="lecture-time">`의 텍스트. `MM:SS`와 `H:MM:SS`를 받는다. `-`, 빈 값, 0은 `durationSec: null`.
  - 수업명이 빈 행은 버린다. OT 행도 수업으로 포함한다.
- 섹션이 없으므로 가상 섹션 1개를 만든다: `id = "megastudy:{courseCode}"`, `title` = 강의명.
- 수업 `id` = `` `megastudy:${courseCode}:${행 순번}` ``. 행 순번은 0부터다. 맛보기 링크의 LEC_CD는 OT 행 등에 없을 수 있어 쓰지 않는다.
- `title` = `<p class="lstedu_bookinfo--tit">`의 텍스트(정리 후). 없으면 "제목 없는 강의".
- `instructor` = `<p class="lstedu_bookinfo--teacher">` 안 첫 `<a>` 텍스트에서 앞의 `[...]`와 끝의 "선생님"을 뗀 값. 예: `[제2외국어] 박수진 선생님` → `박수진`. 없으면 null.
- `platform: "megastudy"`, `courseId: "megastudy:{courseCode}"`, `droppedCount: 0`, `source: "origin"`, `excluded: false`, `order`는 0부터 연속이다.
- 수업이 0개면 `NO_CURRICULUM`.

### 요청
- `fetchMegastudyCurriculum`은 `normalizeInputUrl`을 거친 URL을 받는다고 가정한다.
- `fetchPage(url, { isRequestable: u => isAllowedHost(u) && isMegastudyCoursePath(u), fetchImpl, encoding: "euc-kr" })`로 HTML을 받는다.
- `courseCode`는 `megastudyCourseCode(url)`에서 얻는다. null이면 요청하지 않고 UNSUPPORTED.

### 테스트
- fixture 기준: 강의명 "중국어 어휘 폭풍성장", 강사 "박수진", courseId `megastudy:54549`, 섹션 1개, 수업 21개(OT + 1~20강), 첫 수업 "OT" = 684초, 둘째 "1강. [1,2급] 가족 / 집안" = 3385초, 전체 합은 fixture에서 계산한 상수와 같음.
- 작은 인라인 HTML 케이스:
  - 시간 `-` → null
  - `1:02:03` → 3723
  - 엔티티 디코딩
  - 표 없음 + `| 404` → NOT_FOUND
  - 표 없음 → NO_CURRICULUM
  - 빈 tbody → NO_CURRICULUM
- 가짜 fetch:
  - fixture 바이트를 응답으로 주면 정상 파싱된다(EUC-KR 디코딩이 실제 경로를 탄다).
  - `CHR_CD` 없는 URL이면 fetch 0회 + UNSUPPORTED.

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
   - fixture 구조가 위 설명과 다름: `"status": "blocked"`, `"blocked_reason": "구체적 사유"`를 쓰고 즉시 중단

## 금지사항

- HTML 파서 패키지(cheerio, jsdom 등)를 추가하지 마라. 이유: 표 구조가 단순해 정규식으로 충분하고 의존성을 늘리지 않는다(ADR 철학).
- fixture를 UTF-8로 변환해 저장하지 마라. 이유: 실제 응답 바이트 그대로 둬야 인코딩 경로를 테스트할 수 있다.
- 수업명에서 HTML 태그를 렌더링용으로 남기지 마라. 이유: 외부 문자열은 일반 텍스트로만 다룬다.
- 기존 테스트를 깨뜨리지 마라
