# Selected Ingredients Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Existing approved design and explicit execution request authorize local implementation.

**Goal:** 선택 재료 중심 추천을 기존 전체 추천과 함께 제공한다.

**Architecture:** 전체 재고 스냅샷은 유지하고 선택 재고 ID를 별도로 작업에 저장한다. 서버가 권한·유효성을 검사하고 AI와 결과 분류에 동일한 선택 조건을 전달한다. 선택 UI는 RecipeResults에서 분리한다.

**Tech Stack:** Next.js 16.4.3, React 19, TypeScript, Supabase PostgreSQL, Vitest.

**Spec:** docs/superpowers/specs/2026-11-11-selected-ingredients-design.md

## Global Constraints

- 기존 미커밋 문구·팝업 및 next-env.d.ts 변경 보존.
- push·배포·클라우드 DB 변경 없음. DB 테스트는 loopback 전용.
- 전체 보유 재료 활용, 물만 기본 제공, 선택 재료 최소 하나 포함.
- 초록색·Pretendard와 기존 테마 토큰 사용. 44px 이상 터치 영역.

## Review Focus

- 응답 유실 후 같은 requestId·선택 목록을 유지해야 한다.
- 진행 중인 다른 선택 조건을 같은 작업으로 병합하지 않아야 한다.
- 같은 이름의 여러 재고와 소진·삭제된 선택 항목을 처리해야 한다.
- 과거 선택 없는 내역이 그대로 표시되어야 한다.
- 선택하지 않은 보유 양념을 부족 재료로 표시하지 않아야 한다.

### Task 1: 선택 조건 도메인과 AI 전달

Files: domain.ts/test.ts, ai/contracts.ts, selected-provider.ts/test.ts, job-worker.ts/test.ts, job-contracts.ts, jobs.ts.

Interfaces: classifyRecipes(candidates, ingredients, today, selectedIngredientIds?)와 RecommendationInput.selectedIngredientIds?: string[]. RecipeJob.selectedIngredientIds?: string[].

- [ ] 선택 재료와 겹치지 않는 후보 제외, 전체 재고로 부족 재료 계산, worker 입력·출력, AI에 이름만 전달하는 실패 테스트 작성·실행.
- [ ] 도메인·AI·worker·저장 내역 변환 구현 후 관련 테스트 통과.

### Task 2: DB 접수와 API

Files: 새 migration, database.types.ts, jobs.ts, 추천 POST route, tests/integration/recipe-jobs.test.ts.

Interfaces: enqueue_recipe_job(target_fridge_id, request_id, selected_ingredient_ids default null), enqueueRecipeJob(access, requestId, selectedIngredientIds?).

- [ ] 선택 조건 저장·권한·빈 배열·없는 재고·중복·재전송·다른 조건 충돌 통합 테스트 작성·실행.
- [ ] CLI로 migration 파일 생성, DB에서 검증과 저장을 원자적으로 처리. null은 기존 전체 추천이며 정렬한 선택 배열로 조건 비교.
- [ ] 로컬 migration 반영·타입 생성·DB/통합 테스트. 환경 장애가 있으면 근거와 미검증 범위를 기록하고 가능한 검사 계속 수행.

### Task 3: 재료 선택과 요청 복구

Files: 새 recipe-ingredient-picker.tsx, recipe-results.tsx, use-recipe-job.ts, recipe-list.test.tsx, async-recipes.css.

Interfaces: picker가 모드·선택 ID·검색·페이지 상태를 소유하고 onChange로 요청 조건 전달. start(selectedIngredientIds?)는 요청 객체를 고정해 유실 응답 복구에도 사용.

- [ ] UI 선택·검색·중복 이름·소진 갱신·모드 복원·냉장고 전환·유실 POST 복구 테스트 작성·실행.
- [ ] 승인된 시안 구현. 추천 중 조건 잠금, 선택 0개 실행 방지, 저장 조건 표시, 빈 결과 안내 구현.
- [ ] 컴포넌트·요청 테스트 통과 및 실제 컴포넌트 브라우저 fixture에서 테마·뷰포트·키보드 확인.

### Task 4: 문서와 전체 검증

Files: docs/async-recipes.md, .agents/architecture.md, docs/handoff.md.

- [ ] 현재 동작과 migration·로컬 검증 결과 갱신.
- [ ] 변경 파일 포맷, 전체 단위 테스트, typecheck, lint, build 및 build:worker 수행.
- [ ] 독립 리뷰 후 중요한 결함 수정·회귀 테스트. 결과와 실제 화면·DB 검증 범위 구분 보고.

## Execution ledger

- 2026-11-11: 사용자 승인 설계·시안에 따라 이 세션에서 계속 구현한다. 현재 dev 작업 트리에 기존 변경이 있으므로 그대로 보존하며 작업한다. 별도 커밋·배포 요청은 없다.

- Task 1: 도메인·AI 입력·worker 단위 테스트 RED→GREEN.
- Task 2: RPC·API·migration 구현. Docker named pipe 접근 거부, loopback API fetch 실패로 실제 DB 적용·통합 검증은 차단됨. database.types.ts는 migration 기준 수동 추가이며 CLI 재생성 필요.
- Task 3: 선택 UI·복구·내역 표시 테스트 통과. 실제 컴포넌트 브라우저 fixture 준비했으나 localhost 접근 ERR_NETWORK_ACCESS_DENIED로 화면 확인 불가. 다른 origin/포트로 우회하지 않음.
- Review: 독립 리뷰에서 선택 검증/스냅샷 사이 재고 변경 경합 발견. 하나의 MVCC 스냅샷을 만들고 그 값으로 검증·저장하도록 수정. 실제 동시성 DB 검증은 환경 복구 후 필요.

- Task 4: 전체 단위·컴포넌트 479개(51파일) 통과. worker 빌드 성공. lint 오류 0, 기존 경고 3개 유지(신규 테스트 경고 제거). 최종 타입·제품 빌드 결과는 이어서 기록한다.
- 브라우저 격리 fixture의 소스는 `work/selected-feature-browser/`에 있으며 localhost 접근 차단 후 다른 origin으로 우회하지 않았다. 실제 AI 호출·푸시·배포는 실행하지 않았다.

- 최종 타입 검사 통과, 변경 파일 Prettier 검사 통과, diff 공백 검사 통과. Turbopack build는 compile에서 진전이 없어 중지. webpack build는 `.next/server/app/api/fridges/[fridgeId]` 생성 EPERM으로 실패해 제품 빌드 검증 미완료.

## 커밋·배포 시도 (2026-11-11)

사용자가 커밋과 배포를 명시적으로 승인했다. 기능·알림 변경과 문서 변경을 별도 커밋으로 나누고 next-env.d.ts는 제외하는 계획으로 검토했다. 실제 git add는 `.git/index.lock` 생성 Permission denied로 실패하여 스테이징·커밋을 만들지 못했다. 원격 dev 조회도 getaddrinfo 스레드 생성 실패로 차단되어 push·Actions 실행·운영 변경은 없었다. 전체 포맷 검사는 통과했다. 배포 보호 테스트는 59개 중 56개 통과, 임시 환경파일 이동·복원 테스트 3개가 EPERM으로 실패했다. 기능 코드의 이전 전체 테스트 479개 통과 결과와 이 환경 차단을 구분한다.

## 후속 세션 검증 (2026-11-11)

- Docker·기존 로컬 Supabase·Git 쓰기 가능. `.env.test.local`이 loopback인 것을 확인한 뒤 새 migration만 적용하고 DB 타입 CLI 재생성·비교 완료. DB reset·환경파일 덮어쓰기 없음.
- 단위·컴포넌트 479개, pgTAP 125개, 통합 135개 통과. 선택적 실 API 2개 스킵. 통합 테스트의 직접 재고 변경을 정상 수정 RPC로 바꾸고 변경 결과와 작업 완료 처리 오류도 검증한다.
- 첫 단위 실행의 시간 초과 3건은 동시 빌드 부하를 줄이고 maxWorkers=2로 전체 재실행하여 통과. 테스트 시간 제한이나 제품 동작은 변경하지 않았다.
- 배포 보호 59개, 타입·전체 포맷·린트(기존 경고 3개)·제품 빌드(Node 24.15.0)·worker 빌드·DB 보안 검사 통과.
- 실제 React 컴포넌트 브라우저 fixture: 라이트/다크와 320·390·844·1440px, 44px 터치 영역, 검색·선택 복원·선택 POST·진행 잠금·완료 조건·빈 결과·키보드 확인. 합성 데이터·가짜 API를 사용했으며 실제 AI·푸시·운영 로그인 검증과 구분한다.
- 기능·테스트와 문서를 별도 커밋한 뒤 승인된 기존 dev push 파이프라인으로 배포한다. 최종 Actions·운영 migration·Vercel READY·커밋은 배포 후 별도로 확인한다.
