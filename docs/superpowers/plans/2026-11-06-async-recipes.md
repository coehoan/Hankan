# Async Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** 요청·부분 결과·완료 결과를 영속화하여 화면 이탈 후에도 요리 추천을 이어간다.
**Architecture:** Supabase 작업 테이블과 권한 RPC, lease worker, Next after 즉시 실행, 진행 중 작업 조회 및 개인 내역, 기존 Web Push 확장.
**Tech Stack:** Next 16.4.3, React 19.3.1, Supabase JS 2.118.0 / PostgreSQL 17, Vitest.
**Spec:** docs/superpowers/specs/2026-11-06-async-recipes.md

## Global Constraints

- 기존 A1 미커밋 변경·환경파일·로컬 데이터 보존. 기존 작업 디렉터리에서 통합한다.
- 배포·push·클라우드 DB 변경·유료 AI 테스트·기존 DB reset 금지.
- 권한은 DB에서 실행 시점에 검사. 사용자별 비공개 내역, 출처 비표시.

## Review Focus

- 중복 접수·동시 worker·만료 token: 작업과 공급자 결과가 덮어써지지 않는다.
- 멤버십 회수·다른 사용자: 스냅샷·결과·푸시로 정보가 새지 않는다.
- 공급자 하나 실패·중간 프로세스 종료: 저장된 부분 결과를 보존한다.
- 내역 재진입·냉장고 전환·느린 이전 응답: 현재 화면을 오염시키지 않는다.
- 푸시 해제·재시도·잘못된 URL: 설정을 존중하고 중복 표시·외부 이동을 막는다.

### Task 1: Durable jobs and incremental worker

**Files:** migration async_recipe_jobs, recipes/jobs.ts, recipes/job-worker.ts, recipes/recommendations.ts, jobs/worker.ts, tests/integration/recipe-jobs.test.ts.
**Interfaces:** enqueue_recipe_job(target_fridge_id uuid, request_id uuid); claim_recipe_jobs(target_job_id uuid default null); publish_recipe_source(job_id uuid, token uuid, source_name text, recipes jsonb, succeeded boolean). `processRecipeJobs(jobId?: string): Promise<void>`.

- [x] Write integration tests for enqueue idempotency, snapshot isolation, ownership/RLS, lease recovery/fencing, partial persistence and worker failure.
- [x] Run and observe RED on missing jobs feature.
- [x] Implement DB/RPC and job mapping; providers execute in parallel and publish independently. Regenerate DB types.
- [x] Run local DB integration and provider tests to GREEN.

### Task 2: API and saved result UI

**Files:** recipes route, api/recipe-jobs routes, recipe-results.tsx, job hook/history components, shell/profile-menu.tsx and app-shell.tsx, recipes pages and CSS.
**Interfaces:** POST recipes `{requestId}` →202 `{data:RecipeJob}`; GET recipe-jobs (optional fridgeId) and recipe-jobs/[jobId] → private saved state. `RecipeJob` carries id, fridgeId, status, matches, snapshot ingredients/version/date and timestamps.

- [x] Write failing API/component tests for immediate receipt, partial→complete, remount/history, scope cancellation and permission loss.
- [x] Implement job retrieval, pending-only polling with visibility/online guards, saved detail and profile/inventory history links. Preserve A1 controls and existing usable material checks.
- [x] Run focused tests to GREEN; update legacy synchronous route expectations only where contract changed.

### Task 3: Completion push and verification

**Files:** recipe notification worker/RPC, notifications/types.ts, public/sw.js, docs and tests.

- [x] Write failing delivery and service-worker tests for saved recipe URLs, current opt-in/membership, retries/dedup and invalid paths.
- [x] Connect existing worker and push transport; retain daily digest behavior.
- [x] Run full unit, DB and related integration suites, typecheck, lint, changed-file formatting, app and worker builds, local advisors. Fresh reviewer checks final diff; fix important findings with regression tests.

## Verification ledger

- Implementation authorized by user after interactive preview. Native execution without redundant approval; no commits unless requested. Existing dirty A1 work retained in the shared workspace.

- RED → GREEN: missing queue RPCs, active-request alias retry after completion, accepted/lost POST response recovery, independent worker scheduling, source publication and push URL/opt-in tests.
- Local DB migration applied without reset; DB types regenerated. Six new job integration tests and seven recipe API/service tests passed. Whole integration run: 131 passed, one existing Realtime failure, two optional live-AI cases skipped. The stopped local Realtime container was restarted without DB reset; its one failing case then passed in isolation. Total 132 distinct integration cases verified.
- DB suite: 125 assertions passed after restoring local Realtime; local security advisors: no issues.
- App and standalone worker builds passed. Standalone cache import regression fixed and its new test plus 19 adapter tests passed. Lint: zero errors and three pre-existing warnings. Whole formatting check and git diff --check passed.
- Eighteen offline renders of actual React components with synthetic data at 320/375/1440 widths: no overflow or broken images. Root inspected partial mobile and history desktop. Live authenticated browser and physical push delivery were not exercised.
- Fresh reviewer inspected DB/RLS/leases/API/client/push. Alias-idempotency and lost-response recovery findings fixed with regressions; focused recheck: no remaining actionable findings.
- No commit, push, deployment, production DB write or paid AI request. Existing A1 changes preserved.

- Final post-cache-fix full rerun: 51 unit files / 467 tests passed (37.99s), typecheck and scoped cache lint passed.
