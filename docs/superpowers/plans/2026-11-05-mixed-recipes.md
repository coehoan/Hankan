# Mixed recipes implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current session. Keep all existing uncommitted work; do not commit or deploy.

**Goal:** One recommendation action returns AI and FoodSafety recipes together, without visible source labels.

**Architecture:** A server-only coordinator starts both providers concurrently, validates each independently and merges successful results. Existing service snapshot, permission checks and classification remain authoritative. Keep internal origin data for validation; remove source copy from the UI.

**Tech Stack:** Existing Next.js, TypeScript, Vitest and React. No new dependencies or migrations.

**Spec:** Approved mixed-list preview and user instruction of 2026-11-05. Keep available/needs-shopping groups, ingredients, quantities, steps and unknown metadata behavior.

## Global constraints

- No push, deployment, cloud writes, secret output or paid live AI test.
- Preserve the existing conservative AI prompt and FoodSafety cache/parser.
- One provider failing, timing out or returning invalid output must not discard the other.
- Do not combine ingredient lists or steps from different recipes. For identical normalized names, prefer the canonical catalog record.

## Review focus

- Synchronous missing-key errors must remain isolated.
- Hung provider must settle within 50 seconds and preserve the other result.
- Invalid output or falsely claimed origin must be rejected per provider.
- Empty successful results and duplicate recipe names must have deterministic behavior.
- Existing membership, inventory and date checks must still reject stale results.

### Task 1: Concurrent coordinator and service

Files: create `src/features/recipes/recommendations.ts` and `.test.ts`; modify `service.ts` and `tests/integration/recipes.test.ts`.

Interface: `getMixedRecipeCandidates(input: RecommendationInput): Promise<RecipeCandidate[]>` consumes existing AI registry/catalog/validation functions and returns validated unique candidates for existing classification.

- [x] Write tests for combined results, parallel starts, partial failure in both directions, invalid source isolation, duplicate names, both failures and timeout.
- [x] Run focused unit tests and observe expected failure before implementation.
- [x] Implement independent 50-second provider deadlines, validation and merge; update service safe generic error text.
- [x] Run unit and existing recipe local DB integration tests; make the AI mock reject there so existing catalog failure assertions remain meaningful.

### Task 2: Source-free UI and documentation

Files: modify `recipe-results.tsx`, `recipe-detail.tsx`, `recipe-list.test.tsx`, `.agents/architecture.md`, `docs/foodsafety-recipes.md`.

- [x] Update component assertions for mixed cards/details with no provider/source text and observe failure.
- [x] Remove visible provider intro/footer; preserve all recipe content and metadata.
- [x] Update operation guide to explain AI per-click plus cached catalog, partial success and duplicate policy.
- [x] Run complete unit suite, typecheck, lint, formatting and fresh reviewer. Record verification below; no commit or deployment.

## Verification ledger

- RED: new coordinator module absent; existing component assertions failed on the old visible source footer/intro.
- GREEN: coordinator 11 tests and component 9 tests passed, including parallel invocation, both partial failure directions, invalid origins/output, duplicate name and AI deadline.
- Complete unit suite: 43 files, 300 tests passed after fixing duplicate fixture IDs in the mixed-card test.
- Local DB recipe integration: 7 passed; membership, inventory, date snapshot, origin and private response regressions preserved.
- Typecheck, whole lint and whole Prettier passed (three existing unrelated lint warnings).
- No live paid AI call, browser QA, commit, push or deployment. FoodSafety API smoke was verified in the preceding integration task.
- Fresh review: no production defect found. Strengthened the parallel-start test so both provider promises stay pending until both calls are observed; coordinator 11 tests passed again.
