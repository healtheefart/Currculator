# UI 디자인 가이드

화면의 기준은 Claude Design 프로토타입 `docs/design/prototype.dc.html`(1a 단계별 레이아웃)과 디자인 시스템 토큰 `docs/design/tokens/*.css`다. 문구·간격·상태 표현은 프로토타입을 그대로 따른다. 프로토타입 하단의 "1a 단계별 / 1b 한 페이지" 전환 바는 시안 비교용이므로 만들지 않는다. 프로토타입의 `support.js`·`x-dc`·`sc-if`·`x-import` 문법은 시안 도구용이며 React 컴포넌트로 옮긴다.

## 디자인 원칙
1. 매일 여는 도구처럼 보여야 한다. 장식보다 정보(날짜·시간·분량)가 먼저다.
2. 모바일 우선. 375px 폭에서 가로 스크롤이 없어야 한다(달력·요일 입력 7칸 포함).
3. 무채색 + 포인트 컬러 1가지(파랑 `#0066cc`). 경고·오류도 유채색 대신 검정 배지와 굵은 테두리로 표현한다.

## 금지 사항
| 금지 | 이유 |
|------|------|
| 포인트 파랑 외의 유채색(빨강·주황·초록·보라 등) | 디자인 시스템은 무채색 + 파랑 하나다. 경고·오류도 무채색으로 표현한다 |
| gradient, gradient-text, 글로우 그림자, 배경 장식 orb | 시스템에 없는 장식 |
| 아래 "허용 위치" 밖의 `backdrop-filter` | blur는 sticky 단계 바에만 쓴다 |
| "Powered by AI" 등 장식 배지 | 정보가 아니다 |
| 외부 UI 킷·아이콘 폰트·날짜 선택기 라이브러리 | 의존성 최소화(ADR 철학). 아래 컴포넌트를 직접 만든다 |

## 토큰
`src/app/globals.css`가 `docs/design/tokens/*.css`의 변수를 그대로 `:root`에 정의한다. 컴포넌트는 hex 값을 직접 쓰지 않고 변수(또는 변수에 연결한 Tailwind 테마 값)를 쓴다. 예외: 흰 글자 `#fff`.

### 색상
| 토큰 | 값 | 용도 |
|------|------|------|
| `--color-primary` | #0066cc | 주 버튼, 링크, "오늘" 배지, 체크박스 accent |
| `--color-primary-focus` | #0071e3 | 포커스 링, 선택된 칩·카드 테두리(2px), 선택한 계획 행 왼쪽 막대 |
| `--surface-parchment` | #f5f5f7 | 페이지 배경, 선택된 달력 칸, 칩형 삭제 버튼 배경 |
| `--surface-canvas` | #ffffff | 카드·입력 배경 |
| `--surface-pearl` | #fafafc | 오늘 행, 제외한 수업 행, 선택한 계획 행, 달력 빈 칸 |
| `--surface-chip-gray` | #d2d2d7 | 회색 배지("준비 중", "직접 입력", "직접 옮김", "계획 수정 중"), 지난 단계 점 |
| `--surface-tile-1` | #272729 | 경고 배지·경고 상자 배경(흰 글자), 달력 경고 점 |
| `--surface-black` | #000000 | 상단 GlobalNav |
| `--color-ink` | #1d1d1f | 주 텍스트, 오류 입력 테두리(2px), 선택한 휴식일, 현재 단계 점 |
| `--color-ink-muted-80` (`--text-secondary`) | #333333 | 보조 텍스트 |
| `--color-ink-muted-48` (`--text-tertiary`) | #7a7a7a | 3차 텍스트, 라벨 |
| `--color-hairline` | #e0e0e0 | 카드·입력 테두리 |
| `--color-divider-soft` | #f0f0f0 | 카드 안 행 구분선 |

### 타이포그래피
- 글꼴: Noto Sans KR(Google Fonts 300·400·600·700). `--font-display`와 `--font-text`를 모두 `"Noto Sans KR", sans-serif`로 덮어쓴다.
- `font: var(--type-*)` + `letter-spacing: var(--tracking-*)` 조합을 쓴다. `globals.css`에 `.cc-type-{name}` 유틸리티 클래스를 둔다.
- 숫자(시간·날짜·분량)에는 `font-variant-numeric: tabular-nums`.

| 용도 | 토큰 |
|------|------|
| 학습 자료·URL 단계 제목 | hero-display, `font-size: clamp(34px,6vw,56px)`, 가운데 정렬 |
| 그 아래 설명 | lead-airy, `clamp(19px,2.4vw,24px)`, text-secondary |
| 화면·섹션 제목(계획확인, 일정 설정, 계획 수정, 강의명) | display-lg, `clamp(28px,4vw,40px)` |
| 요약 바 강의명, 달력 월, 확인창 제목, 카드 제목 | tagline |
| 행 제목(날짜, 섹션명, 계획명) | body-strong |
| 본문·입력 | body |
| 라벨·보조 문구·오류 문구 | caption / caption-strong |
| 배지, 수업 위 섹션 라벨, 표 머리글 | fine-print |

### 간격·모서리
- 본문 폭 `max-width: 980px`, 좌우 `padding: 0 20px`, 섹션 사이 `gap: 40px`.
- 카드: 흰 배경, `1px solid var(--color-hairline)`, `border-radius: 18px`(`--radius-lg`). 카드 안 행은 `border-top: 1px solid var(--color-divider-soft)`.
- 작은 입력(요일 분, 오차, 배수, 시작일, 수업 제목·재생 분): `height 44px`(목차 표 안은 40px), `border-radius: 8px`.
- URL 입력: 높이 48px, `border-radius: 980px`(알약형), 좌우 패딩 22px.
- 배지·칩·주 버튼: 알약형(`border-radius: 980px` 또는 `--radius-pill`).
- 터치 대상은 최소 44px(`--touch-min`). 달력 칸·휴식일 칸 포함.

## 컴포넌트 (`src/components/ui/`)
디자인 시스템 번들의 컴포넌트를 React + TypeScript로 옮긴다. 스타일 값은 아래와 같다.

### Button
- `variant="primary"`: 배경 `--color-primary`, 흰 글자, body 글꼴, 알약형, `padding: 11px 22px`.
- `variant="secondary"`: 투명 배경, `--color-primary` 글자와 1px 테두리, 나머지는 primary와 같다.
- `disabled`: 글자 `--color-ink-muted-48`, 배경은 primary면 `--surface-parchment`, secondary면 투명, 테두리 `--color-hairline`, `cursor: default`, 눌림 효과 없음.
- 눌림 효과(`.cc-press`): `:active`에서 `transform: scale(0.95)`, `transition 200ms cubic-bezier(0.25,0.1,0.25,1)`.

### OptionChip
- 알약형 버튼. 흰 배경, `1px solid --color-hairline`, `padding 12px 16px`, 최소 높이 44px, 라벨은 caption-strong, 부가 문구(`detail`)는 caption + text-secondary.
- 선택 시 `2px solid --color-primary-focus`(패딩을 1px 줄여 크기 유지), `aria-pressed="true"`.
- 쓰임: 강의 사이트 선택, 가용 시간 프리셋, 목록/달력 탭. 가로로 늘어나지 않게 `width: auto; white-space: nowrap; padding-inline: 18px`.

### IconButton
- 44×44 원형, 배경 `--surface-chip-translucent`, 아이콘 18px. `aria-label`과 `title`이 필수다. 쓰임: 달력 이전/다음 달.

### TextLink
- `--text-link` 색 글자, 밑줄 없음, hover 시 밑줄. 동작은 `<button type="button">`으로 만든다(`href="#"` 금지).
- 쓰임: "학습 자료 다시 고르기", "예시 강의로 해보기", "계획확인에서 보기", "자동 배분으로 되돌리기", "다시 넣기".

### GlobalNav
- 검정 배경, 높이 44px, 내부 `max-width 1024px; padding 0 22px`. 왼쪽 브랜드 "Currculator"(caption-strong, 흰색), 이어서 메뉴 "계획짜기", "계획확인"(14px, 간격 28px). 현재 메뉴는 불투명도 1 + 굵게(600), 나머지는 0.6. 모바일에서도 메뉴를 숨기지 않는다.
- 디자인 시스템의 검색·계정·햄버거 아이콘은 기능이 없으므로 만들지 않는다.
- 현재 메뉴 링크에 `aria-current="page"`.

### StepBar (계획짜기에서만)
- `position: sticky; top: 0`, 배경 `--surface-frosted` + `backdrop-filter: saturate(180%) blur(20px)`, 아래 `1px solid --color-hairline-alpha`, 최소 높이 52px, 가로 스크롤 허용.
- 단계마다 20px 원 안 번호 + 라벨(caption). 현재 단계: 점 `--color-ink` 배경·흰 글자, 라벨 굵게. 지난 단계: 점 `--surface-chip-gray`. 이후 단계: 점 투명, 라벨 text-tertiary.
- 수정 모드면 맨 앞에 회색 배지 "계획 수정 중".
- 현재 단계 버튼에 `aria-current="step"`.

### Badge
- fine-print, 알약형, `padding 4px 10px`(경고는 `6px 12px`).
- `tone="gray"`: `--surface-chip-gray` 배경. `tone="dark"`: `--surface-tile-1` 배경 + 흰 글자(경고: "허용 범위 밖 · 목표 1시간 / 실제 1시간 25분", "시간 누락"). `tone="primary"`: `--color-primary` 배경 + 흰 글자("오늘").

### ConfirmDialog
- 화면 전체 `rgba(0,0,0,.4)` 오버레이, 가운데 흰 카드(`max-width 360px`, radius 18, padding 28). 제목 tagline, 본문 body + text-secondary, 오른쪽 아래 "취소"(secondary)와 확인 버튼(primary).
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. 열리면 확인 버튼에 포커스, Esc는 취소. `window.confirm`은 쓰지 않는다.

### 아이콘 (`src/components/ui/icons.tsx`)
- lucide 아이콘(v0.469.0)의 SVG path를 인라인 React 컴포넌트로 옮긴다: `monitor-play`, `book-open`, `check`, `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down`, `x`, `grip-vertical`. `stroke="currentColor"`, `strokeWidth 2`, `aria-hidden`.
- CDN에서 아이콘 이미지를 불러오지 않는다.

## 상태 표현
| 상태 | 표현 |
|------|------|
| 입력 오류 | 해당 입력 테두리 `2px solid --color-ink` + 아래(또는 섹션 끝)에 caption 문구. 이전 값 유지 |
| 추출 오류 | URL 입력 아래 caption 문구(`role="alert"`) |
| 허용 범위 밖 날짜 | 목록: dark 배지 "허용 범위 밖 · 목표 X / 실제 Y" (전체 계획에서는 "허용 범위 밖"만). 달력: 날짜 옆 6px 검정 점 |
| 시간 누락 | 목차 행에 dark 배지 "시간 누락" + 재생 분 입력 테두리 2px ink. 목차 위에 dark 상자 "재생시간이 없는 수업이 N개 있어요. 입력하기 전까지 배분에서 빠집니다." |
| 제외한 수업 | 행 배경 `--surface-pearl`, 제목 text-tertiary + 취소선, 예상 "—" |
| 직접 입력한 시간 / 직접 옮긴 수업 | gray 배지 "직접 입력" / "직접 옮김" |
| 오늘 | 목록: 행 배경 pearl + primary 배지 "오늘". 달력: 날짜 숫자에 primary 원 배경 + 흰 글자. 휴식일 달력: 1px ink 테두리 |
| 선택 | 칩·카드: 2px primary-focus 테두리. 달력 칸: parchment 배경 + `inset 0 0 0 2px` primary-focus. 계획 행: pearl 배경 + 왼쪽 3px primary-focus 막대 + 체크 아이콘 |
| 끌어서 놓을 날짜 | 행 배경 parchment + `outline: 2px solid primary-focus; outline-offset: -2px`. 끄는 중인 수업은 불투명도 0.4 |
| 추출 중 | 입력과 버튼 비활성, "강의 정보 가져오는 중…"(body-strong) + 경과 초(tabular-nums, text-tertiary), `aria-live="polite"` |

## 애니메이션
- `.cc-press` 눌림 효과(scale 0.95, 200ms)만 쓴다. 그 밖의 전환·로딩 애니메이션은 넣지 않는다.
- `prefers-reduced-motion: reduce`이면 눌림 효과도 끈다.

## 접근성
- 포커스: `:focus-visible`에 `outline: 2px solid --color-primary-focus; outline-offset: 2px`.
- 버튼처럼 동작하는 요소는 `<button>`을 쓴다. 토글은 `aria-pressed`, 탭형 칩은 `aria-pressed`, 계획 선택 목록은 `role="listbox"`/`role="option"` + `aria-selected`.
- 아이콘만 있는 버튼은 `aria-label` 필수("이전 달", "다음 달", "계획에서 제외", "휴식일 삭제").
- 드래그로만 할 수 있는 동작은 없어야 한다. 수업 이동은 "눌러 선택 → 여기로 옮기기"로도 가능하다.
