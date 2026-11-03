# Step 1: baseline-tests

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/USER_FLOW.md` (Step 0에서 갱신됨)
- `/docs/ARCHITECTURE.md`
- 커밋 `51f7352`(feat: add YouTube playlist and book curriculum sources)의 변경: `git show --stat 51f7352`, `git show 51f7352`

## 배경

커밋 `51f7352`에서 YouTube 재생목록과 책 목차 기능을 추가했다. 그런데 테스트는 고치지 않아서 `npm test`에서 12개가 실패한다(2026-11-03 확인). 실패하는 테스트 파일:
- `src/services/extract/url.test.ts`: ALLOWED_HOSTS에 YouTube 호스트가 추가됨
- `src/lib/errors/messages.test.ts`: 문구가 바뀜
- `src/lib/state/app-reducer.test.ts`: 초기값, SITES 순서(YouTube 추가), PICK_SOURCE book이 `"book"` 단계로 감
- `src/components/build/SourceStep.test.tsx`: 책 카드 문구와 동작이 바뀜
- `src/components/build/UrlStep.test.tsx`: 제목·설명·placeholder 등이 바뀜
- `src/app/page.test.tsx`: `builds and persists a plan`

이 step은 테스트를 **현재 구현의 의도된 동작**에 맞춘다. 이후 step의 AC가 `npm test` 통과를 요구하기 때문이다.

## 작업

1. `npm test`를 실행해 실패 목록과 원인을 확인한다.
2. 실패마다 구현과 테스트 중 어느 쪽이 맞는지 판단한다.
   - 커밋 `51f7352`에서 의도적으로 바꾼 동작(YouTube 호스트 추가, 책 단계 추가, 문구 변경, SITES 목록)이면 테스트 기대값을 구현에 맞게 고친다.
   - `messages.test.ts`는 현재 `messages.ts` 문구에 맞춘다. Step 0에서 USER_FLOW 표를 새 문구로 바꿨지만, `messages.ts`는 Step 7에서 그 표에 맞춘다.
   - 구현이 명백히 버그라면(예: 크래시, 타입과 다른 값, CLAUDE.md CRITICAL 위반) 고치지 말고 `blocked`로 멈춘다. `blocked_reason`에는 파일:줄과 이유를 쓴다.
3. YouTube 추출기(`src/services/extract/youtube.ts`)에는 테스트가 없다. 이 step에서는 만들지 않는다. 이 step의 범위는 기존 실패를 정리하는 것이다.

## Acceptance Criteria

```bash
npm run lint && npm run typecheck && npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다. 실패 0개여야 한다.
2. `git diff --stat`으로 `*.test.ts(x)` 파일만 바뀌었는지 확인한다.
3. 결과에 따라 `phases/1-course-platforms/index.json`의 해당 step을 업데이트한다.
   - 성공: `"status": "completed"`, `"summary": "고친 테스트 파일과 바뀐 기대값 요약"`
   - 수정을 3회 시도한 뒤에도 실패: `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 구현 버그 의심: `"status": "blocked"`, `"blocked_reason": "구체적 사유"`를 쓰고 즉시 중단

## 금지사항

- 테스트가 아닌 파일(`src/**/*.ts(x)` 중 `*.test.*`가 아닌 것)을 수정하지 마라. 이유: 구현의 의도를 이 step에서 판단할 수 없다. 버그로 보이면 blocked로 사용자에게 넘긴다.
- 테스트를 삭제하거나 `skip`·`todo`로 바꾸지 마라. 이유: 보장하던 동작이 사라진다. 기대값을 고친다.
- `src/app/api/extract/route.ts`의 `endsWith("youtube.com")`은 이 step에서 고치지 마라. 이유: Step 6에서 라우트 분기와 함께 고친다.
