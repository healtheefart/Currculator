# Step 2: url-rules

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (허용 호스트·경로 CRITICAL 규칙. Step 0에서 갱신됨)
- `/docs/ADR.md` (ADR-011, ADR-016)
- `/docs/ARCHITECTURE.md` ("패스트캠퍼스 파싱", "메가스터디 파싱")
- `/src/types/curriculum.ts`
- `/src/services/extract/url.ts`, `/src/services/extract/url.test.ts`
- `/src/lib/storage/plans.ts` (platform 값 검증 부분)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

TDD로 진행한다. `url.test.ts`에 테스트를 **먼저** 추가해 실패를 확인한 뒤 구현한다.

### `src/types/curriculum.ts`
- `Platform`에 `"fastcampus"`와 `"megastudy"`를 추가한다.
- `CurriculumItem.id` 주석을 "플랫폼 원본 id 문자열"로 바꾼다.
- `Curriculum.courseId` 주석을 "플랫폼별 강의 id(인프런 숫자, `youtube:`, `fastcampus:`, `megastudy:` 접두)"로 바꾼다.

### `src/lib/storage/plans.ts`
- 저장본 검증에서 허용하는 platform 값에 `"fastcampus"`와 `"megastudy"`를 추가한다. 이걸 빠뜨리면 새 플랫폼 계획이 다시 읽을 때 버려진다.
- `plans.test.ts`에 두 platform이 복원되는 케이스를 먼저 추가한다.

### `src/services/extract/url.ts`
```ts
export const ALLOWED_HOSTS: readonly string[]; // 기존 인프런·YouTube + "fastcampus.co.kr", "www.fastcampus.co.kr", "www.megastudy.net", "megastudy.net"
export function normalizeInputUrl(raw: string): URL | null;
// 기존 동작 + hostname "megastudy.net" → "www.megastudy.net"
// + 메가스터디 pathname이 대소문자 무시로 "/chr/lecture_detailview.asp"이면 "/teacher_v2/chr/lecture_detailview.asp"로 바꾼다
export function isFastcampusCoursePath(url: URL): boolean;
// hostname이 fastcampus.co.kr 또는 www.fastcampus.co.kr이고, pathname이 /^\/[A-Za-z0-9_-]+\/?$/ (한 단계)
export function isMegastudyCoursePath(url: URL): boolean;
// hostname === "www.megastudy.net" && pathname(대소문자 무시) === "/teacher_v2/chr/lecture_detailview.asp"
// && searchParams CHR_CD가 /^\d+$/
export function megastudyCourseCode(url: URL): string | null; // CHR_CD 숫자 문자열 또는 null
```
- 테스트할 URL:
  - 패스트캠퍼스 허용: `https://fastcampus.co.kr/biz_online_claude`, `www.fastcampus.co.kr/biz_online_claude/`(scheme 없음)
  - 패스트캠퍼스 거부: `/`, `/category/x`, `/biz_online_claude/extra`
  - 메가스터디 허용: `https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549&MAKE_FLG=1&tec_cd=21cholic`, `/chr/...`(정규화), `megastudy.net/...`(정규화)
  - 메가스터디 거부: `CHR_CD` 없음, `CHR_CD=abc`, 다른 경로
  - 공통 거부: `fastcampus.co.kr.evil.com`, `https://www.fastcampus.co.kr@evil.com/x`, `http://fastcampus.co.kr/x`, `https://evil.com/www.megastudy.net`

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

- hostname을 `endsWith`·`includes`·정규식 부분 일치로 비교하지 마라. 이유: `fastcampus.co.kr.evil.com` 같은 호스트가 통과한다(CLAUDE.md CRITICAL).
- 메가스터디 `/chr/` 경로를 그대로 요청 대상으로 허용하지 마라. 이유: 이 경로는 HTTP 200으로 404 오류 페이지를 돌려준다. 정규화한 뒤 `/teacher_v2/chr/`만 허용한다.
- 클라이언트 코드(`src/lib/url-input.ts`)는 이 step에서 고치지 마라. 이유: Step 7 범위다.
- 기존 테스트를 깨뜨리지 마라
