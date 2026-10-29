# Notification Save and Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline with TDD.

**Goal:** 알림 OFF 즉시 저장/ON 명시적 저장과 화면 정리를 구현하고 전체 코드를 일관되게 정렬한다.
**Architecture:** 기존 알림 API와 인증/선택 컴포넌트를 유지한다. 공통 persist 함수에 토글와 submit을 연결한다. 기능 변경을 먼저 로컬 커밋하고 포맷을 별도 커밋으로 분리한다.
**Tech Stack:** Next.js, React, TypeScript, CSS, Prettier/SQL plugin.
**Spec:** ../specs/2026-10-29-notification-save-format-design.md

## Global Constraints
- 로컬 변경만. push/배포/클라우드 변경 금지, 비밀/생성/개인 파일 보존.
- OFF 즉시 저장, 실패 복구; ON은 저장 클릭 전 서버에 반영하지 않는다.
- 요청 중 중복 변경 방지, 오프라인/불러오기 실패를 저장 성공으로 표시하지 않는다.
- 포맷과 기능 변경을 분리하고 SQL 문자열·함수 본문 보존을 검증한다.

## Review Focus
- ON으로 편집 후 OFF할 때 유효하지 않은 시간도 OFF 저장을 막지 않는다.
- OFF 요청 실패/중복 조작/페이지 이동 뒤 응답에서도 상태가 실제 저장 결과와 일치한다.
- OFF 상태에서 Enter/직접 submit이 알림을 켜거나 불필요한 저장을 하지 않는다.
- nav 제거 후 주요 화면은 브랜드/프로필/기존 요리 링크로 접근 가능하다.
- 전체 포맷이 SQL 함수/정책/문자열이나 TS/JS 동작을 변경하지 않는다.

### Task 1: 알림 흐름과 화면 정리
**Files:** notifications/settings-form(+tests), shell/app-shell/fridge-switcher(+tests), auth/password-dialog(+tests), CSS.
- [ ] RED: OFF 즉시 PATCH/버튼 부재, ON no-PATCH 후 명시적 저장, 실패 원상복구/중복 방지/오프라인, nav 부재와 버튼명.
- [ ] GREEN: persist 공유·오류 복구·우측 저장, 배지/화살표/nav/버튼 변경. Targeted tests PASS; 기능만 로컬 커밋.

### Task 2: 전체 정렬과 검증
**Files:** formatter 설정·package dev deps/scripts, 전체 추적 코드.
- [ ] Prettier3.9.10/SQL plugin0.20.0 고정, 생성/개인/비밀/문서 제외 설정.
- [ ] 포맷 적용, formatter check/debug-check, SQL 의미 토큰 비교.
- [ ] Full unit(maxWorkers4), local DB/integration, typecheck/lint/build. One fresh read-only review of semantic commit + formatter equivalence; one Important RED→GREEN fix pass if needed. 포맷 별도 로컬 커밋. No release.
