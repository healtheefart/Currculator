# 프로젝트: Currculator

강의 커리큘럼 URL을 넣으면 목차를 추출해서 일자별 학습 계획을 만들어 주는 웹앱. 0-mvp는 프로토타입이다. 상세 기획은 `docs/PRD.md`, 사용자 흐름·유스케이스는 `docs/USER_FLOW.md`, 구조는 `docs/ARCHITECTURE.md`, 결정 근거는 `docs/ADR.md`, 화면 규칙은 `docs/UI_GUIDE.md`를 따른다.

## 기술 스택
- Next.js (App Router)
- TypeScript strict mode
- Tailwind CSS
- 패키지 매니저: npm
- 테스트: Vitest + Testing Library (단위·컴포넌트), Playwright (E2E, fixture 모드)
- 배포: Vercel (다음 phase부터)

## 아키텍처 규칙
- CRITICAL: 외부 사이트 요청은 서버에서만 한다(`src/app/api/` 라우트 → `src/services/`). 클라이언트 컴포넌트는 외부 URL을 직접 fetch하지 않는다.
- CRITICAL: 서버는 허용 호스트만 요청한다: 인프런(`www.inflearn.com`, `inflearn.com`, `inf.run`), YouTube(`www.youtube.com`, `youtube.com`, `m.youtube.com`, `music.youtube.com`), 패스트캠퍼스(`fastcampus.co.kr`, `www.fastcampus.co.kr`), 메가스터디(`www.megastudy.net`, `megastudy.net`). hostname은 이 목록과 정확히 일치로 비교하고(`endsWith`·`includes` 금지) `https:`만 허용한다. 리다이렉트는 수동으로 처리하고 Location의 호스트와 경로를 다음 요청 전에 검사한다.
- CRITICAL: 플랫폼별로 정해진 경로만 요청한다. 인프런은 강의 경로만, YouTube는 `/playlist?list=`만, 패스트캠퍼스는 한 단계 경로 `/{slug}`만, 메가스터디는 `/teacher_v2/chr/lecture_detailview.asp?CHR_CD={숫자}`만 요청한다.
- CRITICAL: 배분 로직(`src/lib/planner/`)은 순수 함수다. 내부에서 I/O, `Date.now()`, `new Date()`, 난수를 쓰지 않는다. "오늘"은 인자로 주입한다.
- CRITICAL: 날짜는 Asia/Seoul 기준 `YYYY-MM-DD` 문자열로 다룬다. planner·types에 `Date` 객체를 노출하지 않는다.
- CRITICAL: 학습 시간은 내부에서 초 단위(배수 적용 시 소수 허용)로 유지한다. 반올림은 화면 표시(`src/lib/format/`)에서만 한다(분 단위, 예: `1시간 25분`).
- CRITICAL: 자동 테스트(`npm test`, `npm run test:e2e`)는 실제 외부 사이트에 요청하지 않는다. `tests/fixtures/`의 저장된 응답만 쓴다.
- CRITICAL: 외부에서 온 문자열(강의명·수업명, localStorage 값)은 React 기본 이스케이프로만 렌더링한다. `dangerouslySetInnerHTML`, `eval`, `new Function`을 쓰지 않는다. localStorage 값은 검증한 뒤에만 쓴다.
- 0-mvp는 프로토타입이다. 플랫폼별 추출기 파일을 두고, 공통 인터페이스·registry는 만들지 않는다. 안전한 요청(리다이렉트 검사·타임아웃)만 `fetch-page.ts`로 공유한다.
- 타입은 `src/types/`에 분리한다.
- 테스트 파일은 대상 파일 옆에 `*.test.ts` / `*.test.tsx`로 둔다(`scripts/hooks/tdd-guard.sh`가 이 위치를 검사한다). 컴포넌트와 API 라우트(`route.test.ts`)도 예외가 아니다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (단위·컴포넌트)
npm run test:e2e   # Playwright (EXTRACT_FIXTURES=1, fixture 모드)
