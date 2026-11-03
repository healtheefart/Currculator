# Step 4: fastcampus-extractor

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md` ("패스트캠퍼스 파싱", "데이터 모델")
- `/docs/ADR.md` (ADR-006, ADR-016)
- `/src/types/curriculum.ts`
- `/src/services/extract/inflearn.ts` (`parseInflearnHtml`의 Curriculum 구성 방식)
- `/src/services/extract/youtube.ts` (`extractJsonAssignment`의 괄호 짝 맞추기 방식)
- `/src/services/extract/fetch-page.ts`, `/src/services/extract/url.ts` (Step 2·3 산출물)
- `/tests/fixtures/fastcampus/biz_online_claude.html` (2026-11-03 저장한 실제 페이지. 약 490KB라 전체를 읽지 말고 `\"curriculum\":[`, `\"courseId\":261444`, `og:title` 주변만 확인한다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

TDD로 진행한다. `src/services/extract/fastcampus.test.ts`를 **먼저** 작성한다(fixture 기반).

```ts
// src/services/extract/fastcampus.ts
export function parseFastcampusHtml(html: string, sourceUrl: string): Curriculum;
export async function fetchFastcampusCurriculum(url: URL, fetchImpl: typeof fetch = fetch): Promise<Curriculum>;
```

### 데이터 위치
- HTML의 `<script>self.__next_f.push([1,"..."])</script>` 조각들의 두 번째 원소가 JS 문자열 리터럴이다. 각 리터럴을 `JSON.parse`로 문자열로 되돌린 뒤 순서대로 이어 붙이면 RSC payload가 된다.
- payload에서 `"curriculum":[`를 찾아 괄호 짝을 맞춰 배열을 잘라내고 `JSON.parse`한다. 문자열 안의 괄호는 무시해야 한다.
- 노드 구조: `{id:number, type:"PART"|"CHAPTER"|"CLIP", title, time:"HH:MM:SS", child?:[], isAppendix?}`.

### 변환 규칙
- 섹션(level 0)은 CHAPTER마다 하나다.
  - `id` = `String(chapter.id)`
  - `title` = `` `${part.title} · ${chapter.title}` ``
  - PART 바로 아래에 CLIP이 있으면 PART 자체를 섹션으로 쓰고 제목은 `part.title`로 한다.
- 수업(level 1)은 CLIP이다. `isAppendix`인 것도 포함한다.
  - `id` = `String(clip.id)`
  - `sectionId` = 소속 섹션 id
  - `durationSec` = `time` 파싱 결과. `H:MM:SS`와 `MM:SS`를 모두 받는다. 0이거나 형식이 틀리면 null.
- CLIP이 없는 섹션은 버린다. 모든 항목은 `source: "origin"`, `excluded: false`이고 `order`는 0부터 연속이다.
- `droppedCount`는 0이다.
- `courseId`는 `` `fastcampus:${id}` ``다. id는 payload의 `"courseId":(\d+)`(queryKey `getCourseById`) 중 첫 값이다. 없으면 NO_CURRICULUM.
- `title`: `og:title`에서 마지막 ` | 패스트캠퍼스`를 떼고 HTML 엔티티(`&amp;` 등)를 디코딩한다. 없으면 `<title>`, 그것도 없으면 "제목 없는 강의".
- `instructor`: 신뢰할 수 있는 필드를 fixture에서 찾지 못하면 null로 둔다. 추측으로 다른 텍스트를 넣지 마라.
- `platform: "fastcampus"`, `sourceUrl`은 인자로 받은 값이다.
- curriculum이 없거나, 파싱에 실패하거나, CLIP이 0개면 `ExtractError("NO_CURRICULUM")`.

### 요청
- `fetchFastcampusCurriculum`은 `fetchPage(url, { isRequestable: u => isAllowedHost(u) && isFastcampusCoursePath(u), fetchImpl })`로 HTML을 받는다. `sourceUrl`은 `url.href`다.

### 테스트 (fixture `biz_online_claude.html`)
- courseId `fastcampus:261444`
- 제목이 "Claude의 모든 것"으로 시작하고 `&amp;`가 `&`로 디코딩됨
- 섹션 수 = CHAPTER 수(16), CLIP 51개
- 첫 수업 "01. OT 이 강의로 무엇을 할 수 있게 되나요" = 704초
- 첫 섹션 제목 "Part 1. Claude 입문 & 핵심 기능 이해 · Ch 1. Claude 시작하기"
- 전체 durationSec 합 = 각 PART `time` 합(fixture에서 직접 계산해 상수로 박는다)
- order 연속, sectionId 정합성
- curriculum 없는 HTML이면 NO_CURRICULUM, 손상된 payload면 NO_CURRICULUM
- 가짜 fetch: 정상 200, 불허 경로 `https://fastcampus.co.kr/a/b`이면 fetch 0회 + UNSUPPORTED

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

- `eval`, `new Function`, `vm`으로 payload를 실행하지 마라. 이유: 외부 문자열 실행 금지(CLAUDE.md CRITICAL). `JSON.parse`만 쓴다.
- 파싱 결과에 `Date` 객체나 반올림한 시간을 넣지 마라. 이유: 시간은 초 단위로 유지하고 반올림은 표시에서만 한다.
- 공통 추출기 인터페이스·registry를 만들지 마라. 이유: ADR-016은 플랫폼별 파일과 fetchPage 공유만 허용한다.
- fixture 파일을 수정하거나 다시 받아오지 마라. 이유: 저장된 실제 응답이 계약 테스트의 기준이다.
- 기존 테스트를 깨뜨리지 마라
