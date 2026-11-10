# 한칸

식재료·유통기한·남은 양을 공동 냉장고에서 관리하는 PWA입니다. Next.js App Router / React / TypeScript / Supabase / OpenAI를 사용합니다.

## 현재 상태

2026-11-06 기준 A1 화면과 비동기 식약처·AI 추천을 운영에 반영했습니다. 서비스는 https://hankan-murex.vercel.app 이며 `dev` push가 GitHub Actions의 검사 → 운영 빌드 → 미적용 DB 마이그레이션 → Vercel 배포를 실행합니다. 사용자 승인 없이 push·배포·클라우드 DB 변경을 하지 않습니다.

다른 PC나 새 에이전트는 [AGENTS.md](AGENTS.md), [현재 상태·인수인계](docs/handoff.md), [문서 지도](docs/README.md)를 먼저 읽으세요. 과거 단계별 설계·계획은 구현 이력이며 현재 상태를 대신하지 않습니다.

## 주요 기능

- 일반 아이디·비밀번호 가입/로그인, 비밀번호 변경과 관리자 초기화. 이메일 인증을 사용하지 않습니다.
- 본인·공유 냉장고, 멤버 공동 편집·이름 변경, 소유자의 24시간·1회 초대와 멤버 관리.
- 냉장·냉동·실온, 필수 기한, 구매 묶음별 남은 양(0~100%, 5단위), 검색·필터·기한 그룹. 버전 충돌과 중복 등록을 방지합니다.
- Supabase private Realtime 신호로 목록 재조회. 유휴 3초 폴링은 없으며 연결 실패는 안내합니다.
- 사진 선택·미리보기 → 품목 확인 시 업로드·AI 분석 → 품목 수정·기한 직접 선택 → 명시적 저장. 원본·임시 파일은 저장/취소 후 정리합니다.
- 추천 즉시 접수와 서버 작업 저장, AI 추천 결과, 화면 이탈 후 복구, 최근 본인 추천 내역 30건, 기존 알림 설정에 따른 완료 푸시. 추천은 재료·남은 양을 차감하지 않습니다.
- A1 라이트·다크·시스템 테마, Pretendard, 자체 재료 SVG 108종, 모바일 화면, PWA와 개인별 일일 알림.

## 로컬 시작

Node `>=24.15.0 <25`와 Docker가 필요합니다. 기존 환경파일·DB·실행 프로세스를 보존하세요. Windows에서는 `npm.cmd`를 사용할 수 있습니다.

```powershell
npm.cmd ci
npm.cmd run db:start
```

로컬 Realtime도 실행되어야 합니다. 새 환경에만 `.env.example`을 참고하여 `.env.local`을 준비하고, B PC의 로컬 Supabase URL·키를 직접 설정합니다. 이미 있는 파일은 덮어쓰지 않습니다. 키를 채팅·로그에 출력하지 마세요. 개발 서버가 로컬이어도 DB는 클라우드일 수 있으므로 실제 연결 대상을 확인합니다.

```powershell
npm.cmd run dev
# 사진 정리·백그라운드 복구가 필요할 때, 같은 로컬 DB 설정으로 별도 실행
npm.cmd run dev:worker
```

브라우저 origin과 `NEXT_PUBLIC_SITE_URL`은 `http://127.0.0.1:3000`으로 일치시킵니다. 영수증 분석과 AI 추천은 서버용 `OPENAI_API_KEY`를 사용합니다. 전체 환경변수와 B 이동 절차는 [인수인계](docs/handoff.md)를 참고하세요.

## 검증

DB·통합 테스트는 `.env.test.local`의 loopback Supabase만 사용합니다. 운영 키로 보호를 우회하지 않습니다.

```powershell
npm.cmd test -- --maxWorkers=4
npm.cmd run test:db
npm.cmd run test:integration
npm.cmd run test:release
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd run build:worker
```

변경 범위에 맞는 검사를 실행합니다. 기본 검사는 유료 AI를 호출하지 않으며 실제 API 평가는 별도입니다. 자동 검사·오프라인 캡처와 실제 기기 인수를 구분하며, 최신 기록·남은 푸시 확인은 [인수 체크리스트](docs/acceptance.md)에 있습니다.

## API와 운영 안내

식재료는 `/api/fridges/:fridgeId/ingredients`의 GET/POST와 `/:ingredientId` PATCH/DELETE를 사용합니다. 새 등록은 UUID `requestId`, 수정·삭제는 `expectedVersion`이 필요합니다. 구매 묶음은 0%가 되어도 직접 삭제 전까지 유지합니다.

추천 POST `/api/fridges/:fridgeId/recipes`는 `{requestId}`를 받아 HTTP 202의 `{data: RecipeJob}`을 반환합니다. 결과·내역은 `/api/recipe-jobs`와 `/api/recipe-jobs/:jobId`에서 읽습니다. 같은 요청·진행 중 작업은 재사용하고, 현재 멤버인 요청자만 읽습니다. 출처·AI 표시는 화면에서 숨기며 저장된 스냅샷을 현재 재료와 혼동하지 않게 안내합니다. [비동기 추천](docs/async-recipes.md)을 참고하세요.

인증 API는 로그인과 private/no-store 응답을 유지합니다. 브라우저의 JSON 변경 요청은 동일 Origin을 검사합니다. [운영](docs/operations.md), [배포](docs/deployment-pipeline.md), [개발·테스트](.agents/development.md)에 실행·복구 기준이 있습니다.
