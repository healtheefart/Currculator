# Currculator

인프런 강의 URL에서 목차를 가져와 날짜별 학습 계획을 만드는 웹앱입니다. 학습 가능한 요일과 시간, 시작일, 휴식일을 설정하면 수업 순서를 유지하며 일정을 나눕니다.

배포 주소: https://currculator.vercel.app

## 사용 방법

1. **강의 커리큘럼**을 선택합니다.
2. 인프런 강의 URL을 붙여 넣고 **목차 가져오기**를 누릅니다. 첫 화면의 **예시 강의로 해보기**도 사용할 수 있습니다.
3. 가져온 수업의 제목과 재생 시간을 확인하고, 이미 들은 수업은 제외합니다.
4. 학습 요일별 시간, 허용 오차, 휴식일, 시작일을 정하고 **계획 만들기**를 누릅니다.
5. **계획확인**에서 날짜별 목록이나 달력을 보고, 저장한 계획을 수정하거나 삭제할 수 있습니다.

## 로컬 실행

Node.js와 npm이 필요합니다. 저장소를 복제한 뒤 아래 명령을 실행합니다.

```bash
npm ci
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 별도 API 키나 데이터베이스 설정은 필요하지 않습니다. Windows PowerShell에서 `npm.ps1` 실행이 차단되면 같은 명령을 `npm.cmd`로 실행할 수 있습니다.

## 검증

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

자동 테스트는 저장된 인프런 HTML fixture를 사용하며 실제 사이트에 요청하지 않습니다. 실제 추출 동작은 실행 중인 앱에서 인프런 강의 URL로 별도 확인해야 합니다.

## 구조와 범위

- `src/app/api/extract/route.ts`와 `src/services/extract/`: 서버에서 인프런 강의 페이지를 요청하고 목차를 추출합니다.
- `src/lib/planner/`: 목차와 설정을 받아 학습 일정을 계산하는 순수 함수입니다.
- `src/components/`: 목차 편집, 일정 설정, 계획 목록·달력 화면입니다.
- `src/lib/storage/plans.ts`: 계획을 브라우저 `localStorage`에 저장합니다.

현재 버전은 **인프런 강의 URL만** 지원합니다. 책과 다른 강의 사이트는 준비 중입니다. 계정이나 서버 저장 기능이 없어 저장한 계획은 해당 브라우저에서만 볼 수 있고, 작성 중인 내용은 새로고침 시 사라집니다. 인프런의 페이지 구조가 바뀌면 목차 추출이 실패할 수 있습니다.

설계 판단은 [`docs/ADR.md`](docs/ADR.md), 데이터 흐름은 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), 상세 사용자 흐름은 [`docs/USER_FLOW.md`](docs/USER_FLOW.md)에 정리했습니다.
