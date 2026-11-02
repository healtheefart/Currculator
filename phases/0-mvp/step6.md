# Step 6: ui-kit

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/UI_GUIDE.md` (전체. 특히 "컴포넌트", "접근성")
- `/docs/ADR.md` (ADR-013)
- `/docs/design/prototype.dc.html` (`x-import component-from-global-scope=...` 쓰임새와 인라인 스타일 확인. 크므로 필요한 부분만)
- `/src/app/globals.css` (Step 0 산출물: 토큰 변수, `.cc-type-*`, `.cc-press`)

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 작업

디자인 시스템 컴포넌트를 `src/components/ui/`에 만든다. 각 파일 옆에 `*.test.tsx`(Testing Library)를 **먼저** 작성한다. 스타일은 Tailwind 클래스(globals.css 테마에 연결한 토큰) 또는 `style`의 CSS 변수로 쓰고, hex 값을 직접 쓰지 않는다(흰 글자 `#fff`만 예외). 값은 UI_GUIDE.md "컴포넌트"를 따른다.

### `Button.tsx`
```ts
interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: "primary" | "secondary"; // 기본 primary
  type?: "button" | "submit";        // 기본 "button"
}
```
- disabled면 비활성 스타일 + `.cc-press` 제거. 테스트: 클릭 호출, disabled일 때 호출 안 됨, type 기본값.

### `OptionChip.tsx`
```ts
interface OptionChipProps { label: string; detail?: string; selected?: boolean; onClick?: () => void; }
```
- `<button type="button" aria-pressed={selected}>`. 테스트: aria-pressed, detail 표시, 클릭.

### `IconButton.tsx`
```ts
interface IconButtonProps { label: string; icon: React.ReactNode; onClick?: () => void; size?: number; }
```
- `aria-label`·`title` = label. 테스트: 접근 이름으로 찾을 수 있음.

### `TextLink.tsx`
```ts
interface TextLinkProps { children: React.ReactNode; onClick: () => void; }
```
- 링크처럼 보이는 `<button type="button">`. 테스트: 클릭.

### `Badge.tsx`
```ts
interface BadgeProps { tone: "gray" | "dark" | "primary"; children: React.ReactNode; size?: "sm" | "md"; } // md = 경고용 큰 패딩
```

### `GlobalNav.tsx`
```ts
interface GlobalNavProps { active: "build" | "view"; onNavigate: (menu: "build" | "view") => void; onBrand: () => void; }
```
- `<nav aria-label="주 메뉴">`. 브랜드 "Currculator" 버튼, 메뉴 "계획짜기"(build), "계획확인"(view). 현재 메뉴에 `aria-current="page"`. 검색·계정·햄버거 아이콘은 만들지 않는다.

### `StepBar.tsx`
```ts
interface StepBarProps {
  steps: { key: string; label: string }[];
  currentKey: string;
  reachableKeys: string[];     // 누를 수 있는 단계
  onSelect: (key: string) => void;
  editing?: boolean;           // true면 앞에 "계획 수정 중" 배지
}
```
- 단계 버튼에 번호(1부터)와 라벨. 현재 단계 `aria-current="step"`. reachable이 아닌 단계는 `disabled`. 지난 단계/현재/이후 단계 점 스타일은 UI_GUIDE.md "StepBar". sticky + frosted blur(이 컴포넌트만 허용).
- 테스트: 번호·라벨, aria-current, 비활성 단계 클릭 시 onSelect 호출 안 됨, editing 배지.

### `ConfirmDialog.tsx`
```ts
interface ConfirmDialogProps { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; }
```
- open이 false면 아무것도 렌더링하지 않는다. `role="dialog"`, `aria-modal="true"`, `aria-labelledby`(제목). 열릴 때 확인 버튼에 포커스, Escape → onCancel, 오버레이 클릭 → onCancel(카드 클릭은 아님). 버튼 "취소"(secondary) · confirmLabel(primary).
- 테스트: 닫힘 시 없음, 버튼 동작, Escape, 포커스.

### `icons.tsx`
- lucide v0.469.0 아이콘을 인라인 SVG 컴포넌트로: `MonitorPlayIcon`, `BookOpenIcon`, `CheckIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `ChevronUpIcon`, `ChevronDownIcon`, `XIcon`, `GripVerticalIcon`. props `size?: number`(기본 18), `className?`. `viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"`.
- path 데이터는 lucide 원본과 같아야 한다. 확실하지 않으면 `npm view lucide-static@0.469.0 dist.tarball`로 받은 패키지(임시 폴더, 프로젝트에 설치하지 않음)의 `icons/*.svg`에서 복사한다. 네트워크가 안 되면 기억하는 lucide path를 쓰되 summary에 적는다.
- 테스트: 각 아이콘이 `aria-hidden` svg를 렌더링.

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
   - UI_GUIDE.md 금지 사항(포인트 파랑 외 유채색, gradient, StepBar 밖 blur)을 지켰는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `lucide-react` 등 아이콘·UI 패키지를 dependencies에 추가하지 마라. 이유: 의존성 최소화(ADR-013). 필요한 아이콘만 인라인으로 옮긴다.
- CDN(unpkg 등)에서 아이콘 이미지를 런타임에 불러오지 마라. 이유: 외부 요청은 서버에서만 하고, 오프라인에서도 아이콘이 보여야 한다.
- `href="#"` 링크로 동작을 만들지 마라. 이유: 스크롤 이동·접근성 문제. `<button>`을 쓴다.
- 기능 컴포넌트(목차·설정·계획)를 만들지 마라. 이유: 다음 step 범위다.
- 기존 테스트를 깨뜨리지 마라
