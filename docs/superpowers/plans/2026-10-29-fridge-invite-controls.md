# Fridge Invite Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline with TDD.

**Goal:** 배지 선택 컴포넌트·간결한 내비게이션·초대 링크 1일 및 비활성 내역 정리·팝업 버튼을 구현한다.
**Architecture:** 기존 FridgeSwitcher 인터페이스를 유지하고 native select를 listbox로 교체한다. 기존 초대 RPC를 새 마이그레이션으로 교체하고 소유자 전용 정리 RPC/HTTP 엔드포인트를 추가한다. AuthForm에 외부 제출 버튼 연결을 허용한다.
**Tech Stack:** Next.js, React, TypeScript, Supabase/Postgres, CSS.
**Spec:** ../specs/2026-10-29-fridge-invite-controls-design.md

## Global Constraints
- 배포/push/클라우드 변경 금지. 기존 데이터와 환경파일, .idea 보존.
- 새 초대만 정확히 24시간; 기존 만료 시각 유지.
- 정리는 현재 소유자만, 활성 링크 및 멤버십 불변, DB에서 대상 판정.
- 삭제된 초대의 대기 중 수락도 실패해야 한다. fridge-first 잠금 순서 유지.
- 선택 컴포넌트와 제출 버튼은 키보드·모바일·보조기기에서 사용 가능.

## Review Focus
- 긴 이름/공유 역할 배지와 작은 화면에서 선택 목록이 잘리지 않는다.
- 선택 취소 시 값과 포커스를 유지하고 disabled 상태에서 열리지 않는다.
- 목록에 표시한 상태가 오래되더라도 정리 RPC는 활성 초대를 삭제하지 않는다.
- 정리와 수락/취소가 동시에 요청되어도 권한과 단일 사용 조건을 유지한다.
- 외부 제출 버튼이 실제 폼 검증/에러/중복 제출 차단과 연결된다.

### Task 1: 선택·헤더·비밀번호 버튼
**Files:** shell/fridge-switcher, app-shell, auth/auth-form/password-dialog, CSS, 관련 테스트.
**Interfaces:** 기존 FridgeSwitcher props 유지; AuthForm formId?/externalSubmit?로 modal 하단 button form 속성 연결.
- [x] RED: 배지 listbox 선택/키보드/닫힘, 헤더 알림·마이페이지 탭 부재, 취소/제출 같은 action 영역 및 실제 폼 연결.
- [x] GREEN: 커스텀 선택, 가로 확장·헤더 정리, 외부 submit 배치. Targeted tests PASS; 로컬 checkpoint.

### Task 2: 초대 기간·비활성 정리 DB/API
**Files:** CLI-generated migration, generated types, sharing/service, api/fridges/[fridgeId]/invites/history, integration/sharing tests.
**Interfaces:** clearInviteHistory(access):Promise<number>; DELETE history returns {deletedCount:number}.
- [x] RED: 24시간 TTL, owner scoped purge preserving active links/memberships, forbidden member/outsider/cross-origin; deletion/accept race fails closed.
- [x] GREEN: 24h create RPC, owner lock purge, accept reread existence guard; 로컬 DB에서만 적용하고 types 갱신. Local tests/advisors PASS; 로컬 checkpoint.

### Task 3: 내역 UI와 검증
**Files:** sharing/members-dialog and tests, CSS.
- [x] RED: 24시간 표시, inactive-only cleanup action, 실패 재시도/성공 갱신/활성 링크 유지.
- [x] GREEN: 명시적 전체 정리 버튼과 서버 결과 표시, 새 링크 1일 안내.
- [x] Full unit(maxWorkers4), local DB/integration, typecheck/lint/build, one fresh read-only review and one Important RED→GREEN fix pass. No release.

## Verification — 2026-10-29

- Task1: six observed RED failures, then13 focused passes. Selector role badges, keyboard selection/cancel/focus, simplified navigation and native form-linked footer submit verified.
- Task2: four observed RED failures, then17 local sharing/history tests passed. New links have exactly24h TTL; existing expiry unchanged; owner-only current-fridge cleanup preserves active/other-fridge links and memberships. Direct RPC and HTTP forbidden/cross-origin cases covered. A real blocked-transaction test reproduced deleted-token acceptance, then passed with locked reread existence check. Migration applied local only; local security advisors at warn/error level found no issues.
- Task3: two observed UI RED failures, then four passes for24h display, inactive history deletion preserving active link, and failed-delete retry.
- One fresh read-only review found an Important long-list visibility issue in the custom selector. A10-fridge viewport test reproduced an offscreen active row(480px bottom versus288px viewport); layout-effect scrolling now keeps End/Home and initial selected option visible. Fixed in one pass; no further Important/Critical findings or Minor findings.
- Final unit243 passed (`work/invite-controls-final-unit.log`), local DB101 passed (`work/invite-controls-all-db.log`), local integration125 passed/two opt-in skipped (`work/invite-controls-all-integration.log`): total469 assertions. Typecheck, lint and build exited0. Three existing lint warnings remain unchanged. A test-only unsupported query option was removed after typecheck caught it; final typecheck/build passed.
- Actual browser/mobile appearance remains unverified due saved local-origin access denial. No policy bypass attempted. No push, deployment, cloud DB or environment-file change. Existing .idea remains untouched. Work stays on dev locally.
