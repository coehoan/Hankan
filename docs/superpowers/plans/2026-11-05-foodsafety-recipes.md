# FoodSafety Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 보유 재료로 식약처 DB의 실제 조리법을 추천한다.
**Architecture:** 서버 전용 API 어댑터가 캐시된 카탈로그를 공급한다. 기존 추천 도메인·검증·스냅샷 보호를 재사용하고 UI는 출처·재료 원문·미제공 메타데이터를 표시한다.
**Tech Stack:** Next.js 16, TypeScript 6, Zod 4, Vitest.
**Spec:** ../specs/2026-11-05-foodsafety-recipes.md

## Global Constraints
- 배포·push·클라우드 DB 쓰기 금지. 기존 미커밋 변경 보존. 새 커밋은 요청 시만.
- 원문 보존, 누락 시간·인분 추정 금지, AI 창작 대체 금지, 서버 키 비공개.
- 카탈로그 최대 10,000건 방어 한도, 페이지 크기 1,000, 캐시 24시간, 네트워크 전체 제한 20초.

## Review Focus
- API 인증 오류/HTML/빈 응답: 안전한 오류와 재시도, 키 노출 금지.
- 두 번째 페이지 실패: 부분 카탈로그를 정상 캐시하지 않음.
- 괄호 속 쉼표·그룹명·중복 재료: 원문 유지와 보수적 분류.
- API 조회 중 멤버 해제/재료 변경: 결과 폐기.
- 시간·인분 null: 0분·null인분이나 AI 출처 문구 표시 금지.

### Task 1: Catalog adapter and contracts
**Files:** src/features/recipes/foodsafety.ts, foodsafety.test.ts, catalog.ts, domain.ts, domain.test.ts, validation.ts, src/features/ai/contracts.ts.
**Interfaces:** getRecipeCandidates(input: RecommendationInput): Promise<RecipeCandidate[]>; getRegisteredRecipe(provider: string, recordId: string): Promise<RecipeCandidate | null>.
- [x] Add failing tests: pagination/cache/concurrent load, malformed records/API error/retry, exact original text, null metadata, aliases and ingredient parsing.
- [x] Run targeted Vitest, implement adapter and canonical registry, rerun green.

### Task 2: Service and user interface
**Files:** src/features/recipes/service.ts, recipe-results.tsx, recipe-detail.tsx, recipe-list.test.tsx, tests/integration/recipes.test.ts, .env.example, .agents/architecture.md.
- [x] Add failing component tests for source/original ingredients/missing metadata; adapt integration fixtures to catalog and test no AI call, stale results and access checks.
- [x] Switch provider to catalog, preserve validation/snapshot guards, display original text/source and nullable metadata.
- [x] Document server-only key, production env setup and caching. No deployment.

### Verification and ledger
- [x] Targeted tests, full unit suite, local recipe integration suite, typecheck/lint/changed-file Prettier.
- [x] Real API read-only smoke through adapter using user key; report counts and source without secrets.
- [x] Fresh reviewer for entire change, address confirmed findings.
- Initial exploration: HTTPS API succeeds; 1,156 rows; 3 have missing ingredients/steps. Existing selected-provider.ts and architecture.md edits preserved.
- Final verification: 42 unit files / 289 tests passed; local recipe integration 7 passed; typecheck, lint (3 pre-existing warnings), Prettier and diff check passed. Real HTTPS adapter smoke loaded both pages and reused its cached snapshot. No DB migrations, push, commit or deployment performed.
- Review finding addressed: malformed delimiters and missing separators could omit ingredients. Five failing regression cases now pass; ambiguous records are excluded as a whole. Reviewer rechecked actual records 822, 781, 739, 740, 432 and 709 with no unresolved findings.
