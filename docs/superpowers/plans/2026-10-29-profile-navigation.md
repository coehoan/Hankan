# Profile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline with TDD.

**Goal:** 프로필 메뉴와 관리 페이지로 기능을 정리하고 테마·등록·비밀번호·알림 조작을 요청한 형태로 변경한다.
**Architecture:** 기존 AppShell과 공통 Dialog를 유지한다. 계정 표시명을 서버 디렉터리에 포함하고 관리 view를 추가한다. 기존 재료·영수증·인증 API를 재사용한다.
**Tech Stack:** Next.js, React, TypeScript, CSS, Supabase.
**Spec:** ../specs/2026-10-29-profile-navigation-design.md

## Global Constraints
- 로컬 변경만. 배포/push/클라우드 변경 금지, .env.local/.idea 보존.
- 모든 멤버 이름 변경과 기존 멤버 관리 권한 유지.
- 영수증은 미리보기 후 품목 확인, 실제 재료 저장은 별도 확인.
- 테마 저장·시스템 추종·알림 일정 저장·로그아웃 정리 동작 유지.
- 새 비밀번호 두 번 확인, 저장 중 닫기 차단, 팝업 성공 시 마이페이지 유지.

## Review Focus
- 관리 화면에서 냉장고 변경 시 이전 냉장고 모달이 남지 않는다.
- 프로필 메뉴와 긴 계정 행은 키보드와 터치로 조작 가능하다.
- 등록 방식 선택 취소 후 기존 목록과 입력 동작이 유지된다.
- 표시명은 본인 서버 조회 결과이며 다른 사람 데이터나 권한으로 사용하지 않는다.
- 토글과 테마 선택 상태를 보조기기가 식별하며 다크·모바일 레이아웃을 유지한다.

### Task 1: 테마·토글·선택 박스
**Files:** shell/theme-provider, fridge-switcher, notifications/settings-form, CSS, 관련 단위 테스트.
**Interfaces:** ThemeSelector 기존 공급자 사용, 알림 draft.enabled와 저장 API 유지.
- [ ] RED: 테마 라디오 세 항목·아이콘/설명·선택 변경, 알림 switch 상태·시간 표시, 소유/공유 option 확인.
- [ ] GREEN: 3분할 테마, switch 스타일, 별도 역할 영역 제거 준비.
- [ ] Run targeted tests; expected PASS. Local checkpoint.

### Task 2: 프로필·냉장고 관리·등록 선택
**Files:** shell/service/contracts/app-shell, 새 profile-menu/fridge-management, app routes, inventory-screen, 관련 테스트.
**Interfaces:** directory.accountName:string → AppShell; AppShell view management; InventoryScreen.onReceiptUpload 콜백 → 기존 UploadForm.
- [ ] RED: 프로필 이니셜과 세 메뉴·닫힘/키보드, 관리 화면 전환/모달, 등록 방식 선택 및 기존 메인 버튼 부재.
- [ ] GREEN: 표시명 조회·보호된 관리 페이지·프로필 메뉴·등록 선택 연결, 기존 공유/영수증 로직 재사용.
- [ ] Run focused unit + local fridge integration tests; expected PASS. Local checkpoint.

### Task 3: 비밀번호 팝업과 전체 검증
**Files:** auth/auth-form, 새 password-dialog, shell/my-page, 관련 테스트와 CSS.
**Interfaces:** AuthForm.onSuccess?/onPendingChange? → PasswordDialog; 독립 페이지 기본 라우팅 유지.
- [ ] RED: 계정 긴 행 키보드 열기, 닫기, 두 비밀번호 검증, 성공 시 닫힘/확인, pending 닫기 차단.
- [ ] GREEN: 모달용 콜백·닫기·링크 제거, 마이페이지 연결·로그아웃 제거.
- [ ] Run units(maxWorkers4), local integration, typecheck, lint, build. Expected PASS. One fresh read-only whole-change review, one Important RED→GREEN fix pass. No release.
