# Step 0: docs-rules

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ADR.md` (ADR-003, ADR-007, ADR-011, ADR-015)
- `/docs/ARCHITECTURE.md` ("디렉토리 구조", "데이터 흐름", "인프런 파싱")
- `/docs/USER_FLOW.md` (UC-01, UC-02, "오류 문구" 표)
- `/src/services/extract/url.ts`, `/src/services/extract/youtube.ts`, `/src/app/api/extract/route.ts` (현재 코드. YouTube 재생목록은 이미 구현돼 있지만 문서에는 반영되지 않았다)

## 배경

이 phase는 패스트캠퍼스와 메가스터디 강의 페이지에서 목차를 추출하는 기능을 추가한다. 2026-11-03 실제 페이지를 확인한 결과는 아래와 같다. 이 step은 **문서만** 고친다. 이후 step 세션은 매번 CLAUDE.md와 docs/*.md를 규칙으로 받으므로, 코드를 바꾸기 전에 규칙을 먼저 맞춰 둔다.

확인 결과:
- **패스트캠퍼스** (`https://fastcampus.co.kr/{slug}`, 예: `/biz_online_claude`): Next.js App Router 페이지다. HTML 안의 `self.__next_f.push([1,"..."])` 문자열 조각(RSC payload)에 `"curriculum":[{id,type:"PART",title,time,child:[{type:"CHAPTER",title,time,child:[{id,type:"CLIP",title,time:"00:11:44",isAppendix}]}]}]`가 들어 있다. 강의 id는 같은 payload의 `"courseId":261444`(queryKey `getCourseById`)이다. robots.txt는 `Allow: /`이다. 강의 URL은 경로가 한 단계(`/{slug}`)라서 URL만으로 강의 페이지를 판별할 수 없다. 페이지에 curriculum이 없으면 `NO_CURRICULUM`으로 처리한다.
- **메가스터디** (`https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=54549`): 서버가 만든 HTML이고 **EUC-KR** 인코딩이다. `<p class="lstedu--subbx_tit">강의목차</p>` 바로 뒤 `<table class="tb_char_opt">`(같은 class의 표가 여러 개 있다)의 각 `<tr>`에서 첫 `<td>`가 수업명, 마지막 `<td class="lecture-time">`이 재생시간(`56:25`)이다. 섹션은 없다. 강의명은 `<p class="lstedu_bookinfo--tit">`, 강사는 `<p class="lstedu_bookinfo--teacher">` 안의 링크 텍스트(`[제2외국어] 박수진 선생님`)이다. `/chr/lecture_detailview.asp` 경로는 **HTTP 200으로 404 오류 페이지**를 돌려준다(본문에 `| 404`). 그래서 `/teacher_v2/chr/` 경로를 쓴다. robots.txt는 이 경로를 막지 않는다.
- **유데미**는 Cloudflare 봇 차단, **에듀윌**은 공개 페이지에 수업 목차가 없어 이번 phase에서 지원하지 않는다.

## 작업

### `/CLAUDE.md`
- 허용 호스트 CRITICAL 규칙을 다음 목록으로 바꾼다: 인프런(`www.inflearn.com`, `inflearn.com`, `inf.run`), YouTube(`www.youtube.com`, `youtube.com`, `m.youtube.com`, `music.youtube.com`), 패스트캠퍼스(`fastcampus.co.kr`, `www.fastcampus.co.kr`), 메가스터디(`www.megastudy.net`, `megastudy.net`). 정확히 일치 비교, `https:`만 허용, 수동 리다이렉트와 Location 검사 규칙은 그대로 둔다.
- 경로 규칙을 플랫폼별로 적는다: 인프런은 강의 경로만, YouTube는 `/playlist?list=`만, 패스트캠퍼스는 한 단계 경로 `/{slug}`만, 메가스터디는 `/teacher_v2/chr/lecture_detailview.asp?CHR_CD={숫자}`만 요청한다.
- "플랫폼이 하나뿐이므로 추상화를 미리 만들지 않는다" 문장은 "플랫폼별 추출기 파일을 두고, 공통 인터페이스·registry는 만들지 않는다. 안전한 요청(리다이렉트 검사·타임아웃)만 `fetch-page.ts`로 공유한다"로 바꾼다.

### `/docs/ADR.md`
- ADR-011 결정 문단의 호스트 목록을 위와 같이 갱신하고 "(2026-11-03 개정)"을 붙인다.
- ADR-016을 추가한다: "패스트캠퍼스·메가스터디 추가, 플랫폼별 추출기 + 공통 안전 요청". 결정 내용은 다음과 같다.
  - 패스트캠퍼스 RSC payload 파싱: CHAPTER를 섹션으로 쓰고 제목은 `{Part 제목} · {Chapter 제목}`으로 붙인다. CLIP은 수업이고 `isAppendix`도 포함한다.
  - 메가스터디 HTML 표 파싱: EUC-KR로 디코딩하고, 강의명으로 가상 섹션 1개를 만든다. OT 행도 수업으로 포함한다.
  - `courseId`는 `fastcampus:{courseId}`, `megastudy:{CHR_CD}`로 쓴다. 인프런은 숫자 그대로, YouTube는 `youtube:{list}`다.
  - 유데미·에듀윌을 제외한 이유를 적는다.
  - 트레이드오프: 두 사이트 구조가 바뀌면 깨지며 fixture 테스트로 감지한다. 패스트캠퍼스는 강의 여부를 URL로 판별할 수 없다.
- ADR-015의 "인프런 강의 id"를 "플랫폼별 강의 id"로 일반화한다.

### `/docs/ARCHITECTURE.md`
- 디렉토리 구조에 다음을 추가한다: `services/extract/youtube.ts`, `fetch-page.ts`, `fastcampus.ts`, `megastudy.ts`, `tests/fixtures/fastcampus/biz_online_claude.html`, `tests/fixtures/megastudy/54549.html`(EUC-KR 원본 바이트).
- 데이터 흐름의 추출 부분을 "hostname 정확 일치로 플랫폼별 추출기 선택"으로 바꾼다.
- "패스트캠퍼스 파싱", "메가스터디 파싱" 절을 위 배경 내용과 다음 실측값으로 추가한다.
  - 패스트캠퍼스 fixture: courseId 261444, Part 7개, CHAPTER 16개, CLIP 51개.
  - 메가스터디 fixture: CHR_CD 54549, 강의명 "중국어 어휘 폭풍성장", 표 행 21개(OT + 1~20강).
  - 정확한 CHAPTER 수와 재생시간 합은 fixture에서 직접 세어 적는다.
- `Curriculum.platform` 설명에 `"youtube" | "book" | "fastcampus" | "megastudy"`를 반영한다.
- EXTRACT_FIXTURES 설명을 "플랫폼별 `tests/fixtures/{platform}/` 폴더를 읽는다"로 바꾼다.

### `/docs/USER_FLOW.md`
- UC-02의 사이트 칩을 `인프런 / YouTube / 패스트캠퍼스 / 메가스터디`(지원)와 `Udemy / 클래스101`(준비 중)로 바꾼다. 준비 중 안내 문구는 "{사이트} 강의는 준비 중이에요."로 한다. placeholder는 사이트별로 적는다: 패스트캠퍼스 `https://fastcampus.co.kr/...`, 메가스터디 `https://www.megastudy.net/teacher_v2/chr/lecture_detailview.asp?CHR_CD=...`.
- 허용 입력에 패스트캠퍼스(`www.` 유무)와 메가스터디(`/chr/` 경로는 `/teacher_v2/chr/`로 정규화, `megastudy.net` → `www.megastudy.net`)를 추가한다.
- "오류 문구" 표를 다음 문구로 바꾼다. 이 표가 이후 `src/lib/errors/messages.ts`의 기준이 된다.
  - INVALID_URL: `링크 형식이 올바르지 않아요. 강의나 재생목록 주소를 붙여 넣어 주세요.`
  - UNSUPPORTED: `지금은 인프런·패스트캠퍼스·메가스터디 강의와 YouTube 재생목록만 지원해요.`
  - NOT_FOUND: `강의 또는 재생목록을 찾을 수 없어요. 주소를 다시 확인해 주세요.`
  - FETCH_FAILED: `강의 또는 재생목록 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.`
  - NO_CURRICULUM: `이 주소에서 커리큘럼을 찾지 못했어요.`
  - ALREADY_PLANNED: 그대로 둔다.

## Acceptance Criteria

```bash
grep -q "fastcampus.co.kr" CLAUDE.md && grep -q "www.megastudy.net" CLAUDE.md && grep -q "ADR-016" docs/ADR.md && grep -q "fetch-page.ts" docs/ARCHITECTURE.md && grep -q "메가스터디" docs/USER_FLOW.md
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 문서끼리 호스트 목록·courseId 형식·오류 문구가 서로 일치하는지 확인한다.
3. 결과에 따라 `phases/1-course-platforms/index.json`의 해당 step을 업데이트한다.
   - 성공: `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정을 3회 시도한 뒤에도 실패: `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입이 필요함: `"status": "blocked"`, `"blocked_reason": "구체적 사유"`를 쓰고 즉시 중단

## 금지사항

- `src/`·`tests/` 코드를 수정하지 마라. 이유: 이 step은 규칙 문서만 다루고, 코드는 이후 step에서 TDD로 바꾼다.
- 허용 호스트 비교 규칙을 완화하는 문구(`endsWith`, 서브도메인 와일드카드)를 넣지 마라. 이유: SSRF 방지 규칙이다.
- 유데미·에듀윌·클래스101을 지원 목록에 넣지 마라. 이유: 추출 가능성을 확인하지 못했다.
