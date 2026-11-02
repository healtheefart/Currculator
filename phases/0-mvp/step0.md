# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/UI_GUIDE.md` (특히 "토큰")
- `/docs/design/tokens/*.css` (디자인 토큰 원본)
- `/.gitignore` (기존 내용 확인)
- `/scripts/hooks/tdd-guard.sh` (테스트 파일 위치 규칙 확인)

현재 저장소에는 문서·스크립트·`tests/fixtures/inflearn/introduction-to-clau.html`만 있고 앱 코드는 없다.

## 작업

Next.js 앱 골격과 테스트 도구를 구성한다. 기능 코드는 만들지 않는다.

1. **Next.js 직접 구성** (App Router, TypeScript strict, Tailwind CSS, ESLint, `src/` 디렉토리, import alias `@/*` → `src/*`)
   - `npm install`로 `next`, `react`, `react-dom`과 dev 의존성(`typescript`, `@types/*`, `tailwindcss` 및 Next 공식 가이드의 Tailwind 연동 패키지, `eslint`, `eslint-config-next`)을 설치한다. 버전은 현재 안정 버전을 쓴다.
   - 설정 파일: `package.json`, `tsconfig.json`(`strict: true`), `next.config.ts`, ESLint 설정, Tailwind/PostCSS 설정.
   - `src/app/layout.tsx`: `<html lang="ko">`, Noto Sans KR 웹폰트(Google Fonts `<link>`: `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;600;700&display=swap`, preconnect 포함), `metadata.title = "Currculator"`.
   - `src/app/globals.css`: Tailwind 로드 + 디자인 토큰. `/docs/design/tokens/`의 `colors.css`·`typography.css`·`spacing.css`·`radii.css`·`elevation.css` 변수를 그대로 `:root`에 옮기고(파일을 import하지 말고 복사. `docs/`는 빌드 대상이 아니다), `--font-display`·`--font-text`는 `"Noto Sans KR", sans-serif`로 덮어쓴다. 추가로:
     - `*,*::before,*::after { box-sizing: border-box }`, `body { margin:0; font: var(--type-body); letter-spacing: var(--tracking-body); color: var(--text-primary); background: var(--surface-parchment); -webkit-font-smoothing: antialiased }`
     - `.cc-type-{hero-display|display-lg|lead-airy|tagline|body-strong|body|caption|caption-strong|fine-print}` 클래스: `font: var(--type-X); letter-spacing: var(--tracking-X)`
     - `.cc-press { transition: transform var(--duration-press) var(--ease-standard) } .cc-press:active { transform: scale(var(--press-scale)) }`, `prefers-reduced-motion: reduce`에서는 transition·transform 없음
     - `:focus-visible { outline: 2px solid var(--color-primary-focus); outline-offset: 2px }`
     - Tailwind v4 `@theme inline`으로 주요 색(`primary`, `primary-focus`, `ink`, `parchment`, `pearl`, `canvas`, `chip-gray`, `tile`, `hairline`, `divider`, `text-secondary`, `text-tertiary`)과 `radius-lg`(18px)를 변수에 연결한다.
   - 상세 규칙은 `/docs/UI_GUIDE.md`의 "토큰".
   - `src/app/page.tsx`: 제목 "Currculator"와 한 줄 설명("강의 URL을 넣으면 내 시간에 맞춘 학습 계획을 만들어 드려요")만 있는 임시 페이지.
2. **Vitest**: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. `vitest.config.ts`(environment jsdom, alias `@`, setup 파일에서 jest-dom 로드, `tests/e2e/**` 제외).
3. **Playwright**: `@playwright/test`, `playwright.config.ts`(testDir `tests/e2e`, chromium만, `webServer`: `npm run dev`, 환경변수 `EXTRACT_FIXTURES=1`, baseURL `http://localhost:3000`). `npx playwright install chromium` 실행.
4. **npm 스크립트**: `dev`, `build`, `start`, `lint`, `typecheck`(`tsc --noEmit`), `test`(`vitest run --passWithNoTests`), `test:e2e`(`playwright test`).
5. **`.gitignore`**: 기존 내용을 유지한 채 `.env*`, `playwright-report/`, `test-results/`, `coverage/`, `/blob-report/`를 추가한다.
6. `src/app/page.test.tsx`: 페이지에 제목 "Currculator"가 렌더링되는지 확인하는 테스트 1개.

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
   - 사용자 개입 필요 (Playwright 브라우저 다운로드 실패 등 네트워크·수동 설정) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 현재 폴더에서 `create-next-app`을 실행하지 마라. 이유: `CLAUDE.md`, `docs/`, `scripts/`, `tests/`가 있어 "비어 있지 않은 폴더"로 실패하거나 기존 파일을 덮어쓴다.
- 대화형 입력을 요구하는 명령을 쓰지 마라. 이유: 비대화형 세션이라 응답할 수 없어 멈춘다. 필요하면 `--yes` 등 비대화형 옵션을 쓴다.
- `.gitignore`, `CLAUDE.md`, `docs/`, `scripts/`, `tests/fixtures/`를 덮어쓰거나 지우지 마라. 이유: 하네스 가드레일과 테스트 데이터다.
- 기능 코드(타입, planner, 추출기, 컴포넌트)를 만들지 마라. 이유: 이후 step의 범위다.
- 기존 테스트를 깨뜨리지 마라
