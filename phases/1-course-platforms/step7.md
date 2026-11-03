# Step 7: client-support

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOW.md` (UC-01, UC-02, "오류 문구" 표. Step 0에서 갱신됨)
- `/docs/UI_GUIDE.md`
- `/docs/ADR.md` (ADR-015, ADR-016)
- `/src/lib/url-input.ts`, `/src/lib/url-input.test.ts`
- `/src/lib/errors/messages.ts`, `/src/lib/errors/messages.test.ts`
- `/src/lib/state/app-reducer.ts`(`SiteId`, `SITES`, 준비 중 사이트 처리), `/src/lib/state/app-reducer.test.ts`
- `/src/components/build/UrlStep.tsx`, `/src/components/build/SourceStep.tsx`, `/src/components/build/CurriculumEditor.tsx` 및 각 테스트
- `/src/services/extract/url.ts` (서버 규칙. 클라이언트에서는 import하지 않고 같은 규칙을 작게 다시 구현한다)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

TDD로 진행한다. 각 파일 옆 테스트를 **먼저** 고친다.

### `src/lib/url-input.ts`
- `checkCourseUrl`
  - 패스트캠퍼스(`fastcampus.co.kr`·`www.fastcampus.co.kr`, 한 단계 경로)는 null이다. 그 밖의 경로는 UNSUPPORTED다.
  - 메가스터디(`www.megastudy.net`·`megastudy.net`, pathname이 대소문자 무시로 `/teacher_v2/chr/lecture_detailview.asp` 또는 `/chr/lecture_detailview.asp`, `CHR_CD`가 숫자)는 null이다. 그 밖은 UNSUPPORTED다.
  - hostname은 정확히 일치로 비교한다.
  - 주의: 지금 `toUrl`은 `m.` 접두를 `www.`로 바꾼다. 이 동작으로 새 호스트가 잘못 허용되거나 거부되지 않는지 테스트로 확인한다.
- `cidFromUrl`: 메가스터디면 `megastudy:{CHR_CD}`를 돌려준다. 패스트캠퍼스는 URL에 강의 id가 없으므로 null이고, 중복 확인은 추출 후 courseId로 한다.

### `src/lib/errors/messages.ts`
- `ERROR_MESSAGES`를 USER_FLOW "오류 문구" 표와 글자까지 같게 맞춘다. 테스트 기대값도 표에서 그대로 옮긴다.

### `src/lib/state/app-reducer.ts`
- `SiteId`에 `"megastudy"`를 추가한다.
- `SITES` 순서: 인프런, YouTube, 패스트캠퍼스, 메가스터디, Udemy, 클래스101.
- 지원 사이트(인프런·YouTube·패스트캠퍼스·메가스터디)를 고르면 그 사이트가 선택된다. Udemy·클래스101만 "준비 중" 안내를 띄운다. 준비 중 여부는 기존 코드가 표현하는 방식을 따르고, 판정은 한 곳에 모은다.

### `src/components/build/UrlStep.tsx`
- placeholder를 사이트별로 바꾼다.
  - 패스트캠퍼스: `https://fastcampus.co.kr/...`
  - 메가스터디: `https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=...`
- 준비 중 칩의 부가 문구와 안내 문구는 USER_FLOW를 따른다.

### 플랫폼 표시 이름
- `src/lib/format/platform.ts`에 다음을 둔다.
  ```ts
  export const PLATFORM_LABELS: Record<Platform, string>
  // inflearn "인프런", youtube "YouTube", fastcampus "패스트캠퍼스", megastudy "메가스터디", book "책"
  ```
- `CurriculumEditor.tsx`의 플랫폼 이름 중첩 삼항식을 이 맵으로 바꾼다. 수업/목차·재생/학습 같은 책 전용 분기는 그대로 둔다.
- `SourceStep.tsx`의 강의 카드 설명을 "인프런·패스트캠퍼스·메가스터디 강의나 YouTube 재생목록 URL로 목차를 가져와요."로 바꾼다. USER_FLOW와 다르면 USER_FLOW를 따른다.

## Acceptance Criteria

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다.
   - ARCHITECTURE.md 디렉토리 구조를 따르는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
   - `src/lib`·`src/components`가 `src/services`를 import하지 않는가?
3. 결과에 따라 `phases/1-course-platforms/index.json`의 해당 step을 업데이트한다.
   - 성공: `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정을 3회 시도한 뒤에도 실패: `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입이 필요함: `"status": "blocked"`, `"blocked_reason": "구체적 사유"`를 쓰고 즉시 중단

## 금지사항

- 클라이언트 컴포넌트에서 패스트캠퍼스·메가스터디 URL을 fetch하지 마라. 이유: 외부 요청은 서버에서만(CLAUDE.md CRITICAL).
- `src/lib/`에서 `src/services/`를 import하지 마라. 이유: 클라이언트 번들에 서버 코드가 들어간다.
- 외부 강의명을 `dangerouslySetInnerHTML`로 렌더링하지 마라. 이유: CLAUDE.md CRITICAL.
- Udemy·클래스101을 지원 사이트로 바꾸지 마라. 이유: 이번 phase 범위가 아니다.
- 기존 테스트를 깨뜨리지 마라
