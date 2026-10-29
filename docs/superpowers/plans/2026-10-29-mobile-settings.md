# Mobile Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline with TDD.

**Goal:** 마이페이지·모바일 화면 정리·공동 냉장고 이름 변경을 로컬에서 구현한다.
**Architecture:** 기존 AppShell의 mypage view, 공통 Dialog/테마 공급자 유지, client preview 업로드, 현재 멤버십을 검증하는 rename RPC.
**Spec:** ../specs/2026-10-29-mobile-settings-design.md

## Global Constraints

- 배포/dev push/클라우드 DDL 금지. 기존 local/cloud 데이터와 환경파일 보존.
- 인증/키보드 접근성/유통기한 확인 저장/알림 서버 동작 유지.
- 모든 현재 멤버 이름 변경 허용, 이름1~80자, 비회원 거부.
- 사진 선택은 미리보기만, 품목 확인 후 네트워크 업로드. 파일 제한과 Object URL 해제.

## Review Focus

1. 마이페이지 인증과 로그아웃/테마/비밀번호 경로, 한칸 로고의 메인 경로.
2. 이름 변경의 현재 멤버십 재검사 및 소유권 불변.
3. 사진 교체/오류/닫기에서 메모리 해제와 실수로 업로드하지 않음.
4. 알림 일정 OFF/요청 실패에 가짜 기본값/연결됨을 표시하지 않음.
5. 기능 동작을 지우지 않고 PC용/영문 장식 문구만 제거, 모달 focus trap 유지.

### Task 1: 마이페이지·문구·모달

**Files:** app layout/mypage page/CSS, shell app-shell/my-page, auth frame/form, common dialog, decorative copy components.
- [x] RED: header inventory+my-page links; account controls/theme in mypage, not header; auth redirect and existing dialog focus checks.
- [x] GREEN: protected mypage, relocate controls, logo navigation, remove specified copy/tips, backdrop blur.

### Task 2: 사진 선택과 미리보기

**Files:** receipts/upload-form.tsx and new form tests, receipts.css.
- [x] RED: file selection previews but does not POST; confirm creates draft; invalid file blocked.
- [x] GREEN: hidden native selector, 사진 업로드 button/preview box and 품목 확인; URL cleanup and existing drafts retained.

### Task 3: 공동 이름 변경

**Files:** CLI-generated migration, generated types, shell service/rename dialog, app/api/fridges/[fridgeId]/route.ts, local integration tests.
- [x] RED: member/owner can rename and see persisted name; outsider/revoked/invalid blocked; UI submits trimmed name.
- [x] GREEN: name-only RPC with membership lock; API origin/auth validation; dialog refreshes directory.

### Task 4: 알림 연결 이동과 검증

**Files:** notifications/settings-dialog/push-controls, shell/my-page, related tests.
- [x] RED: disabled summary absent, no connection area in modal, mypage connection responds to saved schedule changes.
- [x] GREEN: move connection controls to mypage; hide timezone label only; preserve explicit user permission gesture.
- [x] Whole check:stage11, one fresh read-only review, one RED→GREEN Important fix pass. No publish/push/cloud mutation.

## Local implementation verification — 2026-10-29

All four implementation tasks are complete. Accepted user choices: push connection management on MyPage; all current members can rename; photo preview before explicit 품목 확인.

- `work/mobile-settings-verified.log`: check:stage11 exit 0, DB 101 + unit 229 + integration 117 passed; typecheck, lint, Next build and worker build passed. Two opt-in integration cases remain skipped. Lint has three non-blocking warnings (local blob preview image and typed mock parameters).
- One fresh whole-change review found an Important lock-order issue in rename versus member removal. `work/rename-lock-red.log` reproduces SQLSTATE 40P01; aligning fridge-first locks resolves it (`work/rename-lock-green.log`, six tests passed). Migration reapplied only to local Supabase; no cloud changes.
- Final integration suite after that fix: 118 passed, two opt-in cases skipped; final typecheck/lint also checked separately. Total executed DB/unit/integration assertions: 448.
- Minor review observation deferred: browser maxLength counts UTF-16 units, so emoji-heavy names may hit the input limit before 80 code points.
- Existing recipe UI cases failed intermittently in two whole unit runs and passed isolated and three subsequent whole runs without behavioral changes. Temporary diagnostics removed; recipe changes remain decorative copy removal only.
- Actual browser verification is blocked by the saved origin permission for http://127.0.0.1:3000. No alternate browser/origin or policy bypass used. Native phone chooser and dark-mode appearance still require manual visual verification.
- Local preview uses .env.test.local overrides; original .env.local preserved. No deployment, dev push or Supabase cloud migration performed.
